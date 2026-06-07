import { getStripe, stripeEnabled } from "@/lib/payments/stripe";
import { requirePerm } from "@/lib/auth/authorize";

export const dynamic = "force-dynamic";

// Staff-initiated refund. Provide either paymentIntentId or chargeId.
export async function POST(req: Request) {
  const gate = await requirePerm(req, "payments.charge");
  if (gate) return gate;
  if (!stripeEnabled()) return Response.json({ ok: false, error: "Stripe not configured." }, { status: 400 });

  const s = getStripe()!;
  const body = await req.json().catch(() => ({}));
  if (!body.paymentIntentId && !body.chargeId) return Response.json({ ok: false, error: "Missing paymentIntentId or chargeId." }, { status: 400 });

  try {
    const refund = await s.refunds.create({
      ...(body.paymentIntentId ? { payment_intent: body.paymentIntentId } : { charge: body.chargeId }),
      ...(body.amountCents ? { amount: body.amountCents } : {}),
    });
    return Response.json({ ok: true, refundId: refund.id, status: refund.status });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "Refund failed." }, { status: 500 });
  }
}
