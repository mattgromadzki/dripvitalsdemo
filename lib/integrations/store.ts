// Server-side credential store for messaging providers.
// Seeds from env, can be overridden at runtime via the API Keys screen.
// In-memory only (resets on server restart) — for production use a secret
// manager / database, never persist raw secrets in the browser.

export interface EmailCreds { provider: "sendgrid" | "resend"; apiKey?: string; from?: string; }
export interface SmsCreds { provider: "twilio"; accountSid?: string; authToken?: string; from?: string; }

let email: EmailCreds = {
  provider: (process.env.EMAIL_PROVIDER as EmailCreds["provider"]) || "sendgrid",
  apiKey: process.env.SENDGRID_API_KEY || process.env.RESEND_API_KEY,
  from: process.env.EMAIL_FROM,
};
let sms: SmsCreds = {
  provider: "twilio",
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  from: process.env.TWILIO_FROM,
};

import { getBrand, DEFAULT_BRAND_ID } from "@/lib/brands/registry";

/**
 * Per-brand credentials.
 *
 * The default brand (DripVitals) uses the runtime store seeded from the base env
 * vars — unchanged, so existing calls `getEmailCreds()` behave exactly as before.
 *
 * Other brands have a SEPARATE SendGrid/Twilio registration, read from env vars
 * suffixed with the brand's `envKey` (e.g. SENDGRID_API_KEY_VITALSRX,
 * EMAIL_FROM_VITALSRX, TWILIO_ACCOUNT_SID_VITALSRX, …). When a brand's "from" env
 * var is unset we fall back to the brand's registry default so the address is
 * still correct even before all env vars are wired.
 */
export function getEmailCreds(brandId?: string): EmailCreds {
  if (!brandId || brandId === DEFAULT_BRAND_ID) return email;
  const b = getBrand(brandId);
  const sfx = b.envKey ? `_${b.envKey}` : "";
  return {
    provider: (process.env[`EMAIL_PROVIDER${sfx}`] as EmailCreds["provider"]) || "sendgrid",
    apiKey: process.env[`SENDGRID_API_KEY${sfx}`] || process.env[`RESEND_API_KEY${sfx}`],
    from: process.env[`EMAIL_FROM${sfx}`] || b.from,
  };
}
export function getSmsCreds(brandId?: string): SmsCreds {
  if (!brandId || brandId === DEFAULT_BRAND_ID) return sms;
  const b = getBrand(brandId);
  const sfx = b.envKey ? `_${b.envKey}` : "";
  return {
    provider: "twilio",
    accountSid: process.env[`TWILIO_ACCOUNT_SID${sfx}`],
    authToken: process.env[`TWILIO_AUTH_TOKEN${sfx}`],
    from: process.env[`TWILIO_FROM${sfx}`],
  };
}

export function setEmailCreds(patch: Partial<EmailCreds>) { email = { ...email, ...clean(patch) }; }
export function setSmsCreds(patch: Partial<SmsCreds>) { sms = { ...sms, ...clean(patch) }; }
function clean<T extends object>(o: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== "") out[k] = v;
  return out as Partial<T>;
}

const mask = (s?: string) => (s ? "••••••" + s.slice(-4) : null);

export function publicStatus() {
  return {
    email: { provider: email.provider, configured: !!email.apiKey, keyMask: mask(email.apiKey), from: email.from || null },
    sms: { provider: sms.provider, configured: !!(sms.accountSid && sms.authToken), sidMask: mask(sms.accountSid), tokenSet: !!sms.authToken, from: sms.from || null },
  };
}
