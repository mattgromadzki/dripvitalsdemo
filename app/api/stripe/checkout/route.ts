import { getStripe, stripeEnabled, appUrl, priceToCents } from "@/lib/payments/stripe";

export const dynamic = "force-dynamic";

// Creates a Stripe Checkout Session in subscription mode. The card is collected
// securely on Stripe's hosted page (PCI-compliant) — never on our server.
export async function POST(req: Request) {
  if (!stripeEnabled()) return Response.json({ ok: false, disabled: true });
  const s = getStripe()!;
  const body = await req.json().catch(() => ({}));

  const amountCents = body.amountCents || priceToCents(body.price);
  if (!body.email || !amountCents) return Response.json({ ok: false, error: "Missing email or amount." }, { status: 400 });

  const interval = body.interval === "quarterly" ? { interval: "month" as const, interval_count: 3 }
    : body.interval === "annual" || body.interval === "yearly" ? { interval: "year" as const }
    : { interval: "month" as const };

  try {
    const session = await s.checkout.sessions.create({
      mode: "subscription",
      customer_email: body.email,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: (body.currency || "usd").toLowerCase(),
          unit_amount: amountCents,
          recurring: interval,
          product_data: { name: body.planName || "DripVitals treatment plan" },
        },
      }],
      allow_promotion_codes: true,
      metadata: { patientId: body.patientId || "", treatmentId: String(body.treatmentId || ""), planName: body.planName || "", email: body.email },
      subscription_data: { metadata: { patientId: body.patientId || "", planName: body.planName || "", email: body.email } },
      success_url: `${appUrl(req)}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl(req)}/checkout/cancel`,
    });
    return Response.json({ ok: true, url: session.url });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "Checkout failed." }, { status: 500 });
  }
}
