// Cold-outreach ("Farming") module — types. This contact base is entirely
// separate from patients/leads; nothing here references patient records.

export type FarmStatus =
  | "new" | "contacted" | "replied" | "interested" | "won" | "lost" | "unsubscribed";

export const FARM_STATUSES: { key: FarmStatus; label: string; intent: string }[] = [
  { key: "new",         label: "New",         intent: "muted" },
  { key: "contacted",   label: "Contacted",   intent: "blue" },
  { key: "replied",     label: "Replied",     intent: "teal" },
  { key: "interested",  label: "Interested",  intent: "amber" },
  { key: "won",         label: "Won",         intent: "green" },
  { key: "lost",        label: "Lost",        intent: "red" },
  { key: "unsubscribed",label: "Unsubscribed",intent: "muted" },
];

export interface FarmContact {
  id: string;                 // "FC-###"
  firstName: string;
  lastName: string;
  email: string;              // may be "" (SMS-only contact)
  phone: string;              // may be "" (email-only contact)
  company?: string;
  title?: string;
  groupIds: string[];         // many-to-many group membership
  status: FarmStatus;
  source?: string;            // import filename / "Manual" / etc.
  notes?: string;
  optedOut: boolean;          // suppression flag — excluded from all sends
  optOutAt?: string;
  optOutChannel?: "email" | "sms" | "both";
  createdAt: string;
  lastContactedAt?: string;
  lastCampaignId?: string;    // most recent campaign sent to — for reply attribution
  custom?: Record<string, string>;
}

export interface FarmGroup {
  id: string;                 // "FG-###"
  name: string;
  color: string;              // CSS color token/hex
  description?: string;
}

export type FarmChannel = "email" | "sms";
export type CampaignStatus =
  | "draft" | "scheduled" | "sending" | "sent" | "paused" | "canceled";

export type AudienceKind = "all" | "group" | "status" | "selection";
export interface FarmAudience {
  kind: AudienceKind;
  groupIds?: string[];        // kind === "group"
  statuses?: FarmStatus[];    // kind === "status"
  contactIds?: string[];      // kind === "selection"
}

export type SendResult = "sent" | "failed" | "delivered" | "opted_out";

export interface FarmCampaign {
  id: string;                 // "FCMP-###"
  name: string;
  channel: FarmChannel;
  subject?: string;           // email only
  body: string;               // template with {{firstName}} etc; HTML for email
  audience: FarmAudience;
  status: CampaignStatus;
  scheduledAt?: string;       // ISO — when to (start) send
  throttlePerMin?: number;    // max sends per minute (spacing within a batch)
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  // progress (server-authoritative once sending starts)
  totalRecipients: number;
  sent: number;
  delivered: number;          // provider-confirmed deliveries (SMS callback / email webhook)
  failed: number;
  opened?: number;            // unique email opens (our tracking pixel)
  clicked?: number;           // unique email link clicks (our redirect)
  replied?: number;           // inbound replies attributed to this campaign
  cursor?: number;            // resume index into the resolved recipient list
  recipientSnapshot?: string[]; // contact ids resolved at send/schedule time
  results?: Record<string, SendResult>; // contactId -> send outcome
  // Per-recipient engagement logs (contactId -> ISO timestamp of first event).
  deliveredLog?: Record<string, string>;
  openLog?: Record<string, string>;
  clickLog?: Record<string, string>;
  replyLog?: Record<string, string>;
}
