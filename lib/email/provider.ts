import type { SendEmailInput, SendEmailResult } from "./types";
import { getEmailCreds } from "@/lib/integrations/store";
import { getBrand } from "@/lib/brands/registry";

/* Email provider (server-side). Drivers: SendGrid, Resend. Credentials come
   from the runtime store (set via the API Keys screen) and fall back to env.
   Mock when no key. */
function validEmail(e: string) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); }
function parseFrom(from?: string): { email: string; name?: string } {
  const f = from || "DripVitals <care@dripvitals.com>";
  const m = f.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { name: m[1] || undefined, email: m[2] } : { email: f.trim() };
}

async function sendgrid(key: string, from: string, input: SendEmailInput): Promise<SendEmailResult> {
  const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: input.to, name: input.toName }] }],
      from: parseFrom(from), subject: input.subject,
      content: [{ type: "text/html", value: input.html }],
    }),
  });
  if (r.status === 202 || r.ok) return { ok: true, id: r.headers.get("x-message-id") || undefined, provider: "sendgrid" };
  let msg = `SendGrid error (HTTP ${r.status}).`;
  try { const j = await r.json(); msg = j?.errors?.[0]?.message || msg; } catch { /* ignore */ }
  return { ok: false, error: msg, provider: "sendgrid" };
}

async function resend(key: string, from: string, input: SendEmailInput): Promise<SendEmailResult> {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: input.html }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, error: j?.message || `Resend error (HTTP ${r.status}).`, provider: "resend" };
  return { ok: true, id: j?.id, provider: "resend" };
}

export async function sendEmail(input: SendEmailInput, brandId?: string): Promise<SendEmailResult> {
  if (!validEmail(input.to)) return { ok: false, error: "Invalid recipient email.", provider: "email" };
  const c = getEmailCreds(brandId);
  const fallbackFrom = brandId ? getBrand(brandId).from : "DripVitals <care@dripvitals.com>";
  try {
    if (c.provider === "sendgrid" && c.apiKey) return await sendgrid(c.apiKey, input.from || c.from || fallbackFrom, input);
    if (c.provider === "resend" && c.apiKey) return await resend(c.apiKey, input.from || c.from || fallbackFrom, input);
  } catch { return { ok: false, error: "Could not reach the email provider.", provider: c.provider }; }
  return { ok: true, id: "mock_email_" + Date.now().toString(36), provider: "mock" };
}

/** From-address for automated order/billing emails (e.g. orders@email.dripvitals.com). */
export function ordersFrom(): string | undefined {
  return process.env.EMAIL_FROM_ORDERS || undefined;
}
