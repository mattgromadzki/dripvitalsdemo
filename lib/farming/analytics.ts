import type { FarmContact, FarmCampaign } from "@/lib/types/farming";

export interface CampaignFunnel {
  id: string; name: string; channel: "email" | "sms"; status: string;
  recipients: number; sent: number; delivered: number; opened: number; clicked: number; replied: number;
  deliveryRate: number; openRate: number; clickRate: number; replyRate: number;
}
export interface FarmAnalytics {
  totalContacts: number;
  reachableEmail: number;
  reachablePhone: number;
  optedOut: number;
  optOutRate: number;
  // aggregate engagement across campaigns that have sent anything
  sent: number; delivered: number; opened: number; clicked: number; replied: number;
  emailSent: number; smsSent: number;
  openRate: number;      // opened / emailSent
  clickToOpenRate: number; // clicked / opened
  clickRate: number;     // clicked / emailSent
  replyRate: number;     // replied / sent
  deliveryRate: number;  // delivered / sent
  perCampaign: CampaignFunnel[];
}

const rate = (n: number, d: number) => (d > 0 ? n / d : 0);
const hasSent = (c: FarmCampaign) => (c.sent || 0) > 0 || c.status === "sent" || c.status === "sending";

// Pure aggregate of the outreach metrics — everything derives from the stored
// contacts + campaign engagement logs (no synthetic figures).
export function computeFarmAnalytics(contacts: FarmContact[], campaigns: FarmCampaign[]): FarmAnalytics {
  const totalContacts = contacts.length;
  const optedOut = contacts.filter((c) => c.optedOut).length;
  const reachableEmail = contacts.filter((c) => c.email && !c.optedOut).length;
  const reachablePhone = contacts.filter((c) => c.phone && !c.optedOut).length;

  const sentCampaigns = campaigns.filter(hasSent);
  let sent = 0, delivered = 0, opened = 0, clicked = 0, replied = 0, emailSent = 0, smsSent = 0;
  const perCampaign: CampaignFunnel[] = [];

  for (const c of sentCampaigns) {
    const s = c.sent || 0, d = c.delivered || 0, o = c.opened || 0, k = c.clicked || 0, r = c.replied || 0;
    sent += s; delivered += d; opened += o; clicked += k; replied += r;
    if (c.channel === "email") emailSent += s; else smsSent += s;
    perCampaign.push({
      id: c.id, name: c.name, channel: c.channel, status: c.status,
      recipients: c.totalRecipients || 0, sent: s, delivered: d, opened: o, clicked: k, replied: r,
      deliveryRate: rate(d, s), openRate: c.channel === "email" ? rate(o, s) : 0, clickRate: c.channel === "email" ? rate(k, s) : 0, replyRate: rate(r, s),
    });
  }

  return {
    totalContacts, reachableEmail, reachablePhone, optedOut, optOutRate: rate(optedOut, totalContacts),
    sent, delivered, opened, clicked, replied, emailSent, smsSent,
    openRate: rate(opened, emailSent), clickToOpenRate: rate(clicked, opened), clickRate: rate(clicked, emailSent),
    replyRate: rate(replied, sent), deliveryRate: rate(delivered, sent),
    perCampaign,
  };
}
