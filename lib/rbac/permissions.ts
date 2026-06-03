export interface Role { id: string; label: string; }
export const ROLES: Role[] = [
  { id: "owner", label: "Owner / Admin" }, { id: "provider", label: "Provider" }, { id: "support", label: "Support / MA" }, { id: "billing", label: "Billing" },
];
export interface Perm { key: string; label: string; }
export const PERMISSION_GROUPS: { group: string; perms: Perm[] }[] = [
  { group: "Patients", perms: [{ key: "patients.view", label: "View patients" }, { key: "patients.edit", label: "Edit patients" }, { key: "patients.delete", label: "Delete patients" }] },
  { group: "Clinical", perms: [{ key: "intake.review", label: "Review intakes" }, { key: "rx.prescribe", label: "Prescribe / send to pharmacy" }, { key: "labs.order", label: "Order labs" }, { key: "titration.manage", label: "Manage titration" }, { key: "adverse.manage", label: "Manage adverse events" }] },
  { group: "Messaging", perms: [{ key: "email.send", label: "Send email" }, { key: "sms.send", label: "Send SMS" }, { key: "campaigns.send", label: "Send campaigns" }] },
  { group: "Billing", perms: [{ key: "payments.charge", label: "Charge payments" }, { key: "subscriptions.manage", label: "Manage subscriptions" }, { key: "refunds.issue", label: "Issue refunds" }] },
  { group: "Administration", perms: [{ key: "settings.manage", label: "Manage settings" }, { key: "users.manage", label: "Manage users & roles" }, { key: "integrations.manage", label: "Manage integrations / API keys" }] },
];
export const ALL_PERMS = PERMISSION_GROUPS.flatMap((g) => g.perms.map((p) => p.key));

export const DEFAULT_ROLE_PERMS: Record<string, string[]> = {
  owner: ALL_PERMS,
  provider: ["patients.view", "patients.edit", "intake.review", "rx.prescribe", "labs.order", "titration.manage", "adverse.manage", "email.send", "sms.send"],
  support: ["patients.view", "patients.edit", "email.send", "sms.send", "campaigns.send"],
  billing: ["patients.view", "payments.charge", "subscriptions.manage", "refunds.issue"],
};
