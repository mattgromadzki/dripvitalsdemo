import { sendSms } from "@/lib/sms/provider";
import type { SendSmsInput } from "@/lib/sms/types";
export async function POST(req: Request) {
  let input: SendSmsInput;
  try { input = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid body.", provider: "unknown" }, { status: 400 }); }
  if (!input?.to || !input?.body) return Response.json({ ok: false, error: "Recipient and body are required.", provider: "unknown" }, { status: 400 });
  return Response.json(await sendSms(input));
}
