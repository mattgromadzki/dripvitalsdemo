import { corepayConfigured, corepayCreateHppOrder } from "@/lib/payments/corepay";
import { savePendingOrder } from "@/lib/payments/hppStore";
import { appUrl, priceToCents } from "@/lib/payments/stripe";

export const dynamic = "force-dynamic";

/**
 * Starts a hosted-payment-page checkout for the public intake flow. The patient's
 * card is collected on the gateway's PCI-compliant page; we only ever see the
 * resulting transaction id (via the success redirect + webhook). Returns { url }
 * for the client to redirect to. Public on purpose — intake has no staff session.
 */
export async function POST(req: Request) {
  if (!corepayConfigured()) {
    return Response.json({ ok: false, error: "Hosted payments are not configured." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const amountCents = Number(body.amountCents) || priceToCents(body.price);
  if (!amountCents) return Response.json({ ok: false, error: "Missing amount." }, { status: 400 });

  const currency = (body.currency || "USD").toUpperCase();
  const interval: "monthly" | "quarterly" = /quarter/i.test(String(body.interval)) ? "quarterly" : "monthly";
  const clientOrderId = String(body.clientOrderId || `dv-${Date.now()}`).slice(0, 100);
  const base = appUrl(req);
  const addr = body.address || {};

  await savePendingOrder({
    clientOrderId,
    email: body.email,
    name: (body.name || `${body.firstName || ""} ${body.lastName || ""}`).trim() || undefined,
    firstName: body.firstName,
    lastName: body.lastName,
    planName: body.planName,
    planId: body.planId,
    med: body.med || body.planName,
    amountCents,
    currency,
    interval,
    treatmentId: body.treatmentId ?? null,
    createdAt: new Date().toISOString(),
  });

  const result = await corepayCreateHppOrder({
    amountCents,
    currency,
    successUrl: `${base}/checkout/success?order=${encodeURIComponent(clientOrderId)}`,
    cancelUrl: `${base}/checkout/cancel`,
    failedUrl: `${base}/checkout/cancel?status=failed`,
    clientOrderId,
    orderDesc: body.planName || "DripVitals treatment plan",
    descriptor: "DripVitals",
    customer: {
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
      address: addr.line1,
      city: addr.city,
      state: addr.state,
      zip: addr.zip,
      countryCode: addr.countryCode || "US",
    },
  });

  if (!result.ok || !result.redirectUrl) {
    return Response.json({ ok: false, error: result.error || "Could not start secure checkout." }, { status: 502 });
  }
  return Response.json({ ok: true, url: result.redirectUrl, orderId: result.orderId });
}
