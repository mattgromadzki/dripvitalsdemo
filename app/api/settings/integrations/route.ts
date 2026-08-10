import { publicStatus, setEmailCreds, setSmsCreds } from "@/lib/integrations/store";
import { requireAuth, requirePerm } from "@/lib/auth/authorize";

export async function GET(req: Request) {
  const gate = requireAuth(req); if (gate) return gate;
  return Response.json(publicStatus());
}

export async function POST(req: Request) {
  const gate = await requirePerm(req, "integrations.manage"); if (gate) return gate;
  let body: { email?: { provider?: "sendgrid" | "resend"; apiKey?: string; from?: string }; sms?: { accountSid?: string; authToken?: string; from?: string } };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid body." }, { status: 400 }); }
  if (body.email) setEmailCreds(body.email);
  if (body.sms) setSmsCreds({ ...body.sms, provider: "twilio" });
  return Response.json({ ok: true, status: publicStatus() });
}
