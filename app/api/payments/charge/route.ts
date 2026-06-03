import { charge } from "@/lib/payments/provider";
import type { ChargeInput } from "@/lib/payments/types";

export async function POST(req: Request) {
  let input: ChargeInput;
  try { input = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid body.", provider: "unknown" }, { status: 400 }); }
  if (!input?.sourceId || !input?.amountCents || input.amountCents <= 0) {
    return Response.json({ ok: false, error: "sourceId and a positive amount are required.", provider: "unknown" }, { status: 400 });
  }
  return Response.json(await charge(input));
}
