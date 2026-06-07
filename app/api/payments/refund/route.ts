import { refund } from "@/lib/payments/provider";
import { record } from "@/lib/payments/stripeLedger";
import { requirePerm } from "@/lib/auth/authorize";

export const dynamic = "force-dynamic";

// Staff-initiated refund through the active payment provider (CorePay, etc.).
export async function POST(req: Request) {
  const gate = await requirePerm(req, "payments.charge");
  if (gate) return gate;

  const body = await req.json().catch(() => ({}));
  const paymentId = body.paymentId || body.chargeId || body.paymentIntentId;
  if (!paymentId) return Response.json({ ok: false, error: "Missing paymentId." }, { status: 400 });

  const res = await refund({ paymentId, amountCents: body.amountCents, currency: body.currency, reason: body.reason });
  if (res.ok) {
    await record({
      id: `ref_${res.refundId || paymentId}_${Date.now()}`, kind: "refund", provider: res.provider,
      email: body.email || "", name: body.name, patientId: body.patientId,
      amountCents: body.amountCents, currency: body.currency || "usd", status: "refunded",
      createdAt: new Date().toISOString(),
    });
  }
  return Response.json(res);
}
