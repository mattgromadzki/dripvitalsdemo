import { sendEmail } from "@/lib/email/provider";
import { requirePerm } from "@/lib/auth/authorize";
import type { SendEmailInput } from "@/lib/email/types";

export async function POST(req: Request) {
  const gate = await requirePerm(req, "email.send"); if (gate) return gate;
  let input: SendEmailInput;
  try { input = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid body.", provider: "unknown" }, { status: 400 }); }
  if (!input?.to || !input?.subject) return Response.json({ ok: false, error: "Recipient and subject are required.", provider: "unknown" }, { status: 400 });
  return Response.json(await sendEmail(input));
}
