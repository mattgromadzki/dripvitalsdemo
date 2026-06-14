import type { SendSmsInput, SendSmsResult } from "./types";
import { getSmsCreds } from "@/lib/integrations/store";

/* SMS provider (server-side). Driver: Twilio. Credentials come from the runtime
   store (set via the API Keys screen) and fall back to env. Mock when no creds. */
function validPhone(p: string) { return /[0-9]{7,}/.test(p.replace(/[^\d]/g, "")); }

export async function sendSms(input: SendSmsInput, brandId?: string): Promise<SendSmsResult> {
  if (!validPhone(input.to)) return { ok: false, error: "Invalid phone number.", provider: "sms" };
  if (!input.body.trim()) return { ok: false, error: "Message body is empty.", provider: "sms" };
  const c = getSmsCreds(brandId);
  if (c.accountSid && c.authToken && c.from) {
    try {
      const params: Record<string, string> = { To: input.to, From: c.from, Body: input.body };
      if (input.statusCallback) params.StatusCallback = input.statusCallback; // Twilio posts delivery updates here
      const body = new URLSearchParams(params);
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${c.accountSid}/Messages.json`, {
        method: "POST",
        headers: { Authorization: "Basic " + Buffer.from(`${c.accountSid}:${c.authToken}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return { ok: false, error: j?.message || `Twilio error (HTTP ${r.status}).`, provider: "twilio" };
      return { ok: true, id: j.sid, status: j.status, provider: "twilio" };
    } catch { return { ok: false, error: "Could not reach Twilio.", provider: "twilio" }; }
  }
  return { ok: true, id: "mock_sms_" + Date.now().toString(36), status: "sent", provider: "mock" };
}
