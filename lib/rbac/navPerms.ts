// Single source of truth mapping app routes to the permission required to use
// them. Used by the sidebar (to hide nav) and RouteGuard (to block direct URL
// access). Routes not listed are available to any signed-in user. Owners have
// every permission, so they always pass.
export const NAV_PERM: Record<string, string> = {
  // Clinical
  "/orders": "patients.edit",
  "/shipments": "patients.edit",
  "/queue": "patients.edit",
  "/intake-review": "intake.review",
  "/titration": "titration.manage",
  "/side-effects": "adverse.manage",
  "/soap": "patients.edit",
  "/rx": "rx.prescribe", "/e-prescribe": "rx.prescribe",
  "/labs": "labs.order",
  "/video": "patients.edit",
  "/tasks": "patients.edit",
  "/referrals": "patients.edit",
  "/patient-chat": "email.send",
  "/emails": "email.send",
  "/sms": "sms.send",
  "/consent": "patients.edit",
  // Business
  "/subscriptions": "subscriptions.manage",
  "/payments": "payments.charge",
  "/billing": "payments.charge",
  "/marketing": "campaigns.send", "/automations": "campaigns.send", "/pipeline": "campaigns.send", "/affiliate": "campaigns.send",
  // Records
  "/audit-log": "settings.manage",
  // Settings / administration
  "/roles": "users.manage", "/staff": "users.manage", "/team": "users.manage",
  "/integrations": "integrations.manage", "/api-keys": "integrations.manage", "/connections": "integrations.manage",
  "/settings": "settings.manage", "/treatments": "settings.manage", "/medications": "settings.manage",
  "/pharmacies": "settings.manage", "/email-templates": "settings.manage", "/notifications": "settings.manage", "/licensure": "settings.manage",
};

/** The permission required for a path (longest matching route prefix), or null. */
export function requiredPermFor(path: string): string | null {
  let best: string | null = null;
  let bestLen = -1;
  for (const route in NAV_PERM) {
    if ((path === route || path.startsWith(route + "/")) && route.length > bestLen) {
      best = NAV_PERM[route]; bestLen = route.length;
    }
  }
  return best;
}
