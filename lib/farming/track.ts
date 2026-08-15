import "server-only";
import { readDomain, writeDomain } from "./serverStore";
import type { FarmCampaign, FarmContact } from "@/lib/types/farming";

const CAMPAIGNS = "farming-campaigns";
const CONTACTS = "farming-contacts";
const digits = (p: string) => (p || "").replace(/[^\d]/g, "").slice(-10);

// Read-modify-write a single campaign in the persisted blob.
export async function mutateCampaign(campaignId: string, fn: (c: FarmCampaign) => void): Promise<boolean> {
  const camps = (await readDomain<FarmCampaign[]>(CAMPAIGNS)) || [];
  const camp = camps.find((c) => c.id === campaignId);
  if (!camp) return false;
  fn(camp);
  await writeDomain(CAMPAIGNS, camps);
  return true;
}

// Idempotent first-event stamp into one of the engagement logs + count sync.
function stamp(camp: FarmCampaign, log: "openLog" | "clickLog" | "deliveredLog" | "replyLog", count: "opened" | "clicked" | "delivered" | "replied", contactId: string) {
  const m = (camp[log] = camp[log] || {});
  if (!m[contactId]) { m[contactId] = new Date().toISOString(); camp[count] = Object.keys(m).length; }
}

export function recordOpen(camp: FarmCampaign, contactId: string) { stamp(camp, "openLog", "opened", contactId); }
export function recordClick(camp: FarmCampaign, contactId: string) { stamp(camp, "clickLog", "clicked", contactId); stamp(camp, "openLog", "opened", contactId); /* a click implies an open */ }
export function recordDelivered(camp: FarmCampaign, contactId: string) { stamp(camp, "deliveredLog", "delivered", contactId); }
export function recordFailure(camp: FarmCampaign, contactId: string) { camp.results = camp.results || {}; camp.results[contactId] = "failed"; }

// Correlate a provider email event (SendGrid) to a campaign by recipient address
// → the contact's most recent campaign. Used for delivery/bounce (opens & clicks
// come from our own pixel/redirect instead).
export async function recordEmailEvent(email: string, kind: "delivered" | "failed"): Promise<void> {
  const em = (email || "").trim().toLowerCase();
  if (!em) return;
  const contacts = (await readDomain<FarmContact[]>(CONTACTS)) || [];
  const c = contacts.find((x) => x.email.toLowerCase() === em);
  if (!c || !c.lastCampaignId) return;
  await mutateCampaign(c.lastCampaignId, (camp) => { if (kind === "delivered") recordDelivered(camp, c.id); else recordFailure(camp, c.id); });
}

// Attribute an inbound reply to the contact's most recent campaign + mark them.
export async function recordReply(match: { phone?: string; email?: string }): Promise<boolean> {
  const contacts = (await readDomain<FarmContact[]>(CONTACTS)) || [];
  const ph = match.phone ? digits(match.phone) : "";
  const em = (match.email || "").trim().toLowerCase();
  const c = contacts.find((x) => (ph && digits(x.phone) === ph) || (em && x.email.toLowerCase() === em));
  if (!c) return false;
  if (c.status !== "unsubscribed") c.status = "replied";
  await writeDomain(CONTACTS, contacts);
  if (c.lastCampaignId) await mutateCampaign(c.lastCampaignId, (camp) => stamp(camp, "replyLog", "replied", c.id));
  return true;
}
