import "server-only";
import { readDomain, writeDomain } from "./serverStore";
import { personalize } from "./personalize";
import { signOptOut, signTrack } from "./optout";
import { pageAudience, audienceCount, updateContactFields } from "./contactsDb";
import { recordSent } from "./sendsDb";
import { sendEmail } from "@/lib/email/provider";
import { sendSms } from "@/lib/sms/provider";
import type { FarmCampaign } from "@/lib/types/farming";

const CAMPAIGNS = "farming-campaigns";
const MAX_BATCH = 40; // hard cap per invocation (keeps a run well under maxDuration)

function appBase(): string {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app.dripvitals.com").replace(/\/+$/, "");
}
function unsubUrl(contactId: string): string {
  return `${appBase()}/api/farming/unsubscribe?c=${encodeURIComponent(contactId)}&t=${signOptOut(contactId)}`;
}
function clickUrl(campaignId: string, contactId: string, target: string): string {
  return `${appBase()}/api/farming/track/click?m=${campaignId}&c=${encodeURIComponent(contactId)}&t=${signTrack(campaignId, contactId)}&u=${encodeURIComponent(target)}`;
}
function pixelUrl(campaignId: string, contactId: string): string {
  return `${appBase()}/api/farming/track/open?m=${campaignId}&c=${encodeURIComponent(contactId)}&t=${signTrack(campaignId, contactId)}`;
}
// Route every link in the body through the click-tracking redirect. Existing
// href="…" attributes and bare URLs are both handled; the two regexes don't
// overlap (a URL inside href="…" is preceded by a quote, not whitespace/`>`).
function trackLinks(html: string, campaignId: string, contactId: string): string {
  return html
    .replace(/href="(https?:\/\/[^"]+)"/g, (_m, u) => `href="${clickUrl(campaignId, contactId, u)}"`)
    .replace(/(^|[\s>])(https?:\/\/[^\s<"]+)/g, (_m, pre, u) => `${pre}<a href="${clickUrl(campaignId, contactId, u)}">${u}</a>`);
}

// Wrap a personalized email body (plain text or HTML) with click tracking, a
// compliant unsubscribe footer, and an open-tracking pixel.
function emailHtml(body: string, contactId: string, campaignId: string): string {
  const safe = /<[a-z][\s\S]*>/i.test(body) ? body : `<p>${body.replace(/\n/g, "<br>")}</p>`;
  const tracked = trackLinks(safe, campaignId, contactId);
  const link = unsubUrl(contactId);
  return `<div style="font-family:system-ui,-apple-system,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a">
${tracked}
<hr style="border:none;border-top:1px solid #eee;margin:24px 0 12px">
<p style="font-size:11.5px;color:#8a8a8a">You received this because you were added to a DripVitals outreach list. <a href="${link}" style="color:#8a8a8a">Unsubscribe</a>.</p>
<img src="${pixelUrl(campaignId, contactId)}" width="1" height="1" alt="" style="display:none">
</div>`;
}

// SMS: append a one-time opt-out hint if the body doesn't already mention STOP.
function smsBody(body: string): string {
  return /stop/i.test(body) ? body : `${body}\n\nTxt STOP to opt out`;
}

export interface DispatchSummary { processedCampaigns: number; sent: number; failed: number; skipped: number; details: { id: string; sent: number; failed: number; done: boolean }[] }

/**
 * Processes due scheduled campaigns server-side. Called by the cron every minute
 * and inline by "Send now" (pass campaignId). Recipients are PAGED from the
 * contacts DB by keyset (no in-memory snapshot), each send is recorded one-row in
 * farming_sends, and per-contact fields update one row at a time — so a campaign
 * to millions drains across cron runs with flat memory. Resumable via the
 * campaign's keyset `cursor`; throttled to min(MAX_BATCH, throttlePerMin) per run.
 */
export async function dispatchDueCampaigns(opts: { campaignId?: string; now?: number } = {}): Promise<DispatchSummary> {
  const now = opts.now ?? Date.now();
  const campaigns = (await readDomain<FarmCampaign[]>(CAMPAIGNS)) || [];
  if (!Array.isArray(campaigns) || !campaigns.length) return { processedCampaigns: 0, sent: 0, failed: 0, skipped: 0, details: [] };

  const summary: DispatchSummary = { processedCampaigns: 0, sent: 0, failed: 0, skipped: 0, details: [] };

  const due = campaigns.filter((c) =>
    (opts.campaignId ? c.id === opts.campaignId : true) &&
    (c.status === "scheduled" || c.status === "sending") &&
    (Date.parse(c.scheduledAt || "") || 0) <= now,
  );

  for (const camp of due) {
    if (!camp.startedAt) {
      camp.totalRecipients = await audienceCount(camp.audience || { kind: "all" }, camp.channel);
      camp.cursor = 0; // reused as an opaque audience cursor (string) below
      camp.startedAt = new Date(now).toISOString();
    }
    camp.status = "sending";
    const limit = Math.max(1, Math.min(MAX_BATCH, camp.throttlePerMin || MAX_BATCH));
    // `cursor` is stored as a string keyset token (or 0 on first run).
    const cursor: string | null = typeof camp.cursor === "string" ? camp.cursor : null;
    const page = await pageAudience(camp.audience || { kind: "all" }, camp.channel, cursor, limit);

    let sent = 0, failed = 0;
    for (const c of page.contacts) {
      if (c.optedOut) { summary.skipped++; continue; } // live suppression re-check
      const subject = personalize(camp.subject || "", c);
      const body = personalize(camp.body || "", c);
      let ok = false;
      if (camp.channel === "email") {
        const res = await sendEmail({ to: c.email, toName: [c.firstName, c.lastName].filter(Boolean).join(" "), subject: subject || camp.name, html: emailHtml(body, c.id, camp.id) });
        ok = res.ok;
      } else {
        const statusCallback = `${appBase()}/api/farming/webhook/sms-status?m=${camp.id}&c=${encodeURIComponent(c.id)}`;
        const res = await sendSms({ to: c.phone, body: smsBody(body), statusCallback });
        ok = res.ok;
      }
      await recordSent(camp.id, c.id, ok ? "sent" : "failed");
      if (ok) { sent++; await updateContactFields(c.id, { lastContactedAt: new Date().toISOString(), lastCampaignId: camp.id, ...(c.status === "new" ? { status: "contacted" } : {}) }); }
      else failed++;
    }

    // Advance the keyset cursor. A null next cursor means the audience is
    // exhausted → campaign complete.
    camp.cursor = page.nextCursor;
    camp.sent = (camp.sent || 0) + sent;
    camp.failed = (camp.failed || 0) + failed;
    const done = !page.nextCursor;
    if (done) { camp.status = "sent"; camp.completedAt = new Date(now).toISOString(); }

    summary.processedCampaigns++;
    summary.sent += sent;
    summary.failed += failed;
    summary.details.push({ id: camp.id, sent, failed, done });
  }

  if (summary.processedCampaigns) await writeDomain(CAMPAIGNS, campaigns);
  return summary;
}
