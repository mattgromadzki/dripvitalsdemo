import type { FarmContact, FarmGroup, FarmCampaign } from "@/lib/types/farming";

// Small demo seed (gated by NEXT_PUBLIC_SEED_DEMO_DATA via seedList in the store).
// Real usage builds its own contact base via manual add + CSV/XML import.

export const FARM_GROUPS_SEED: FarmGroup[] = [
  { id: "FG-101", name: "Med spa prospects", color: "#2f6df6", description: "Aesthetic clinics in South FL" },
  { id: "FG-102", name: "Gym & wellness partners", color: "#0e9f6e", description: "Referral partner outreach" },
  { id: "FG-103", name: "Reactivation", color: "#f59e0b", description: "Went cold — re-engage" },
];

export const FARM_CONTACTS_SEED: FarmContact[] = [
  { id: "FC-1001", firstName: "Alicia", lastName: "Moreno", email: "alicia@glowmedspa.com", phone: "+1 (305) 555-0110", company: "Glow Med Spa", title: "Owner", groupIds: ["FG-101"], status: "new", source: "Manual", optedOut: false, createdAt: "2026-07-20T14:00:00Z" },
  { id: "FC-1002", firstName: "Brandon", lastName: "Cole", email: "brandon@ironpeakgym.com", phone: "+1 (786) 555-0142", company: "Iron Peak Gym", title: "GM", groupIds: ["FG-102"], status: "contacted", source: "Manual", optedOut: false, createdAt: "2026-07-21T15:00:00Z", lastContactedAt: "2026-08-01T16:00:00Z" },
  { id: "FC-1003", firstName: "Chandra", lastName: "Iyer", email: "chandra.iyer@example.com", phone: "+1 (954) 555-0173", company: "Renew Wellness", title: "Director", groupIds: ["FG-101", "FG-103"], status: "replied", source: "Import", optedOut: false, createdAt: "2026-07-22T13:00:00Z" },
  { id: "FC-1004", firstName: "Derek", lastName: "Nunes", email: "derek@example.com", phone: "+1 (561) 555-0188", groupIds: [], status: "new", source: "Import", optedOut: false, createdAt: "2026-07-25T12:00:00Z" },
  { id: "FC-1005", firstName: "Elena", lastName: "Park", email: "elena.park@example.com", phone: "", company: "Park Aesthetics", groupIds: ["FG-101"], status: "interested", source: "Manual", optedOut: false, createdAt: "2026-07-28T11:00:00Z" },
];

export const FARM_CAMPAIGNS_SEED: FarmCampaign[] = [
  {
    id: "FCMP-501", name: "Med spa intro — email", channel: "email",
    subject: "Partnership idea for {{company}}", body: "Hi {{firstName}},\n\nWe help clinics like {{company}} add a GLP-1 weight-loss program with zero overhead. Worth a quick chat?\n\n— The DripVitals team",
    audience: { kind: "group", groupIds: ["FG-101"] }, status: "draft",
    throttlePerMin: 30, createdAt: "2026-08-05T10:00:00Z",
    totalRecipients: 0, sent: 0, delivered: 0, failed: 0,
  },
  {
    id: "FCMP-502", name: "Reactivation text", channel: "sms",
    body: "Hi {{firstName}}, it's DripVitals — still interested in a partnership? Reply YES and we'll set up a call.",
    audience: { kind: "group", groupIds: ["FG-103"] }, status: "draft",
    throttlePerMin: 20, createdAt: "2026-08-06T10:00:00Z",
    totalRecipients: 0, sent: 0, delivered: 0, failed: 0,
  },
];
