import { getStripe, stripeEnabled, appUrl } from "@/lib/payments/stripe";
import { requireAuth } from "@/lib/auth/authorize";

export const dynamic = "force-dynamic";

// Opens Stripe's hosted Billing Portal so a customer can update their card
// (failed-payment recovery), view invoices, or cancel. Pass a customerId.
export async function POST(req: Request) {
  const gate = requireAuth(req);
  if (gate) return gate;
  if (!stripeEnabled()) return Response.json({ ok: false, error: "Stripe not configured." }, { status: 400 });

  const s = getStripe()!;
  const body = await req.json().catch(() => ({}));
  if (!body.customerId) return Response.json({ ok: false, error: "Missing customerId." }, { status: 400 });

  try {
    const session = await s.billingPortal.sessions.create({
      customer: body.customerId,
      return_url: `${appUrl(req)}/subscriptions`,
    });
    return Response.json({ ok: true, url: session.url });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "Could not open portal." }, { status: 500 });
  }
}
