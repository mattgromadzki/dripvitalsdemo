import "server-only";
import * as sends from "./sendsDb";
import { findByEmail, markReplied as contactReplied } from "./contactsDb";

// Engagement tracking — thin delegators over the per-recipient farming_sends
// table. Counts for analytics are aggregated from that table (sendsDb), never by
// per-event writes to the campaign blob, so this stays cheap at scale.

export const recordOpen = (campaignId: string, contactId: string) => sends.markOpened(campaignId, contactId);
export const recordClick = (campaignId: string, contactId: string) => sends.markClicked(campaignId, contactId);
export const recordDelivered = (campaignId: string, contactId: string) => sends.markDelivered(campaignId, contactId);
export const recordFailure = (campaignId: string, contactId: string) => sends.markFailed(campaignId, contactId);

// SendGrid delivery/bounce → correlate by recipient email → their last campaign.
export async function recordEmailEvent(email: string, kind: "delivered" | "bounced" | "failed"): Promise<void> {
  const c = await findByEmail(email);
  if (!c || !c.lastCampaignId) return;
  if (kind === "delivered") await sends.markDelivered(c.lastCampaignId, c.id);
  else if (kind === "bounced") await sends.markBounced(c.lastCampaignId, c.id);
  else await sends.markFailed(c.lastCampaignId, c.id);
}

// Inbound reply (SMS/email) → mark the contact replied + stamp their last campaign.
export async function recordReply(match: { phone?: string; email?: string }): Promise<boolean> {
  const hit = await contactReplied(match);
  if (!hit) return false;
  if (hit.lastCampaignId) await sends.markReplied(hit.lastCampaignId, hit.contactId);
  return true;
}
