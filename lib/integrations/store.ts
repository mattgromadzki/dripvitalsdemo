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

export function getEmailCreds(): EmailCreds { return email; }
export function getSmsCreds(): SmsCreds { return sms; }

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
