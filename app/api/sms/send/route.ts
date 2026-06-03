import { sendSms } from "@/lib/sms/provider";
import type { SendSmsInput } from "@/lib/sms/types";

export async function POST(req: Request) {
  let input: SendSmsInput;
  try { input = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid body.", provider: "unknown" }, { status: 400 }); }
  if (!input?.to || !input?.body) return Response.json({ ok: false, error: "Recipient and body are required.", provider: "unknown" }, { status: 400 });

  // Tell Twilio where to POST delivery-status updates for this message.
  let statusCallback: string | undefined;
  try { statusCallback = new URL(req.url).origin + "/api/sms/status"; } catch { /* ignore */ }

  return Response.json(await sendSms({ ...input, statusCallback }));
}
