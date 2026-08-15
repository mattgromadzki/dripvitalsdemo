import "server-only";
import { readDomain, writeDomain } from "./serverStore";
import { personalize } from "./personalize";
import { signOptOut } from "./optout";
import { sendEmail } from "@/lib/email/provider";
import { sendSms } from "@/lib/sms/provider";
import type { FarmCampaign, FarmContact, SendResult } from "@/lib/types/farming";

const CONTACTS = "farming-contacts";
const CAMPAIGNS = "farming-campaigns";
const MAX_BATCH = 40; // hard cap per invocation (keeps a run well under maxDuration)

function appBase(): string {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app.dripvitals.com").replace(/\/+$/, "");
}
function unsubUrl(contactId: string): string {
  return `${appBase()}/api/farming/unsubscribe?c=${encodeURIComponent(contactId)}&t=${signOptOut(contactId)}`;
}

// Wrap a personalized email body (plain text or HTML) with a compliant footer.
function emailHtml(body: string, contactId: string): string {
  const safe = /<[a-z][\s\S]*>/i.test(body) ? body : `<p>${body.replace(/\n/g, "<br>")}</p>`;
  const link = unsubUrl(contactId);
  return `<div style="font-family:system-ui,-apple-system,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a">
${safe}
<hr style="border:none;border-top:1px solid #eee;margin:24px 0 12px">
<p style="font-size:11.5px;color:#8a8a8a">You received this because you were added to a DripVitals outreach list. <a href="${link}" style="color:#8a8a8a">Unsubscribe</a>.</p>
</div>`;
}

// SMS: append a one-time opt-out hint if the body doesn't already mention STOP.
function smsBody(body: string): string {
  return /stop/i.test(body) ? body : `${body}\n\nTxt STOP to opt out`;
}

function resolveAudience(camp: FarmCampaign, contacts: FarmContact[]): FarmContact[] {
  const a = camp.audience || { kind: "all" };
  let list = contacts;
  if (a.kind === "group") { const g = new Set(a.groupIds || []); list = contacts.filter((c) => c.groupIds.some((x) => g.has(x))); }
  else if (a.kind === "status") { const st = new Set(a.statuses || []); list = contacts.filter((c) => st.has(c.status)); }
  else if (a.kind === "selection") { const ids = new Set(a.contactIds || []); list = contacts.filter((c) => ids.has(c.id)); }
  // Channel viability + suppression at resolution time.
  return list.filter((c) => !c.optedOut && (camp.channel === "email" ? !!c.email : !!c.phone));
}

export interface DispatchSummary { processedCampaigns: number; sent: number; failed: number; skipped: number; details: { id: string; sent: number; failed: number; done: boolean }[] }

/**
 * Processes due scheduled campaigns server-side. Called by the cron every minute
 * and inline by "Send now" (pass campaignId). Resumable + throttled: each call
 * sends at most min(MAX_BATCH, throttlePerMin) recipients per campaign and advances
 * a cursor, so a large list drains across successive cron runs and survives restarts.
 */
export async function dispatchDueCampaigns(opts: { campaignId?: string; now?: number } = {}): Promise<DispatchSummary> {
  const now = opts.now ?? Date.now();
  const campaigns = (await readDomain<FarmCampaign[]>(CAMPAIGNS)) || [];
  const contacts = (await readDomain<FarmContact[]>(CONTACTS)) || [];
  if (!Array.isArray(campaigns) || !campaigns.length) return { processedCampaigns: 0, sent: 0, failed: 0, skipped: 0, details: [] };

  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const summary: DispatchSummary = { processedCampaigns: 0, sent: 0, failed: 0, skipped: 0, details: [] };
  let contactsDirty = false;

  const due = campaigns.filter((c) =>
    (opts.campaignId ? c.id === opts.campaignId : true) &&
    (c.status === "scheduled" || c.status === "sending") &&
    (Date.parse(c.scheduledAt || "") || 0) <= now,
  );

  for (const camp of due) {
    // First touch: resolve + snapshot the recipient set so later edits to groups
    // don't change who a running campaign targets.
    if (!camp.recipientSnapshot) {
      const recips = resolveAudience(camp, contacts);
      camp.recipientSnapshot = recips.map((c) => c.id);
      camp.totalRecipients = recips.length;
      camp.cursor = 0;
      camp.results = camp.results || {};
      camp.startedAt = new Date(now).toISOString();
    }
    camp.status = "sending";
    const snapshot = camp.recipientSnapshot;
    const limit = Math.max(1, Math.min(MAX_BATCH, camp.throttlePerMin || MAX_BATCH));
    let processed = 0, sent = 0, failed = 0;
    let i = camp.cursor || 0;

    for (; i < snapshot.length && processed < limit; i++) {
      const c = contactById.get(snapshot[i]);
      if (!c) { camp.results![snapshot[i]] = "failed"; continue; }
      if (c.optedOut) { camp.results![c.id] = "opted_out"; summary.skipped++; continue; } // live suppression re-check

      const personalizedSubject = personalize(camp.subject || "", c);
      const personalizedBody = personalize(camp.body || "", c);
      let ok = false;
      if (camp.channel === "email") {
        const res = await sendEmail({ to: c.email, toName: [c.firstName, c.lastName].filter(Boolean).join(" "), subject: personalizedSubject || camp.name, html: emailHtml(personalizedBody, c.id) });
        ok = res.ok;
      } else {
        const res = await sendSms({ to: c.phone, body: smsBody(personalizedBody) });
        ok = res.ok;
      }
      camp.results![c.id] = ok ? "sent" : "failed";
      if (ok) { sent++; c.lastContactedAt = new Date().toISOString(); if (c.status === "new") c.status = "contacted"; contactsDirty = true; }
      else failed++;
      processed++;
    }

    camp.cursor = i;
    camp.sent = (camp.sent || 0) + sent;
    camp.failed = (camp.failed || 0) + failed;
    camp.delivered = camp.sent; // provider delivery callbacks not wired for outreach; treat sent as delivered
    const done = i >= snapshot.length;
    if (done) { camp.status = "sent"; camp.completedAt = new Date(now).toISOString(); }

    summary.processedCampaigns++;
    summary.sent += sent;
    summary.failed += failed;
    summary.details.push({ id: camp.id, sent, failed, done });
  }

  if (summary.processedCampaigns) await writeDomain(CAMPAIGNS, campaigns);
  if (contactsDirty) await writeDomain(CONTACTS, contacts);
  return summary;
}
