import { getEmailCreds, getSmsCreds } from "@/lib/integrations/store";

export async function POST(req: Request) {
  let which: string;
  try { which = (await req.json())?.which; } catch { return Response.json({ ok: false, error: "Invalid body." }, { status: 400 }); }
  try {
    if (which === "email") {
      const c = getEmailCreds();
      if (!c.apiKey) return Response.json({ ok: false, error: "No API key set." });
      const url = c.provider === "sendgrid" ? "https://api.sendgrid.com/v3/scopes" : "https://api.resend.com/domains";
      const r = await fetch(url, { headers: { Authorization: `Bearer ${c.apiKey}` } });
      return Response.json(r.ok ? { ok: true, message: `${c.provider} key is valid.` } : { ok: false, error: `${c.provider} rejected the key (HTTP ${r.status}).` });
    }
    if (which === "sms") {
      const c = getSmsCreds();
      if (!c.accountSid || !c.authToken) return Response.json({ ok: false, error: "Account SID and Auth Token required." });
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${c.accountSid}.json`, { headers: { Authorization: "Basic " + Buffer.from(`${c.accountSid}:${c.authToken}`).toString("base64") } });
      return Response.json(r.ok ? { ok: true, message: "Twilio credentials are valid." } : { ok: false, error: `Twilio rejected the credentials (HTTP ${r.status}).` });
    }
    return Response.json({ ok: false, error: "Unknown target." }, { status: 400 });
  } catch { return Response.json({ ok: false, error: "Could not reach the provider (network)." }); }
}
