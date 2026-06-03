import { publicStatus, setEmailCreds, setSmsCreds } from "@/lib/integrations/store";

export async function GET() { return Response.json(publicStatus()); }

export async function POST(req: Request) {
  let body: { email?: { provider?: "sendgrid" | "resend"; apiKey?: string; from?: string }; sms?: { accountSid?: string; authToken?: string; from?: string } };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid body." }, { status: 400 }); }
  if (body.email) setEmailCreds(body.email);
  if (body.sms) setSmsCreds({ ...body.sms, provider: "twilio" });
  return Response.json({ ok: true, status: publicStatus() });
}
