import { healthStatuses } from "@/lib/integrations/health";
import { getEmailCreds, getSmsCreds } from "@/lib/integrations/store";

export async function GET() { return Response.json({ items: healthStatuses() }); }

export async function POST(req: Request) {
  let id = "";
  try { id = (await req.json())?.id; } catch { return Response.json({ ok: false, error: "Invalid body." }, { status: 400 }); }
  try {
    if (id === "email") {
      const c = getEmailCreds(); if (!c.apiKey) return Response.json({ ok: false, error: "No API key set (mock mode)." });
      const url = c.provider === "sendgrid" ? "https://api.sendgrid.com/v3/scopes" : "https://api.resend.com/domains";
      const r = await fetch(url, { headers: { Authorization: `Bearer ${c.apiKey}` } });
      return Response.json(r.ok ? { ok: true, message: `${c.provider} reachable.` } : { ok: false, error: `HTTP ${r.status}` });
    }
    if (id === "sms") {
      const c = getSmsCreds(); if (!c.accountSid || !c.authToken) return Response.json({ ok: false, error: "No credentials set (mock mode)." });
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${c.accountSid}.json`, { headers: { Authorization: "Basic " + Buffer.from(`${c.accountSid}:${c.authToken}`).toString("base64") } });
      return Response.json(r.ok ? { ok: true, message: "Twilio reachable." } : { ok: false, error: `HTTP ${r.status}` });
    }
    // payments & pharmacy: report configuration (no safe no-op ping endpoint)
    const item = (await import("@/lib/integrations/health")).healthStatuses().find((x) => x.id === id);
    if (!item) return Response.json({ ok: false, error: "Unknown connector." }, { status: 400 });
    return Response.json(item.status === "connected" ? { ok: true, message: "Credentials configured — live calls run from your server." } : { ok: false, error: "Not configured — using mock fallback." });
  } catch { return Response.json({ ok: false, error: "Could not reach the provider (network)." }); }
}
