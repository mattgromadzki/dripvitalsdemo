import { corepayConfigured, corepayCreateHppOrder, corepayGetOrder } from "@/lib/payments/corepay";
import { savePendingOrder, getPendingOrder, updateSubscriptionCard } from "@/lib/payments/hppStore";
import { record } from "@/lib/payments/stripeLedger";
import { appUrl } from "@/lib/payments/stripe";

export const dynamic = "force-dynamic";

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * Lets a patient replace the card backing their subscription, PCI-safely:
 *   begin    → opens NetValve's hosted page in AUTHORIZATION mode (validates the
 *              card without a real charge) and returns a redirect URL.
 *   finalize → after the hosted-page return, reads the order back via /order to
 *              capture the new transaction id + card, and repoints the
 *              subscription's billing token so future /rebill uses the new card.
 *
 * NOTE: patient-portal auth is client-side in this prototype, so this trusts the
 * subscriptionId/email sent by the client. A production build must verify a
 * patient session server-side so one patient can't update another's card.
 */
export async function POST(req: Request) {
  if (!corepayConfigured()) return json({ ok: false, error: "Card updates aren't available right now." }, 400);

  const body = await req.json().catch(() => ({}));
  const action = body.action || "begin";
  const base = appUrl(req);

  if (action === "begin") {
    const subscriptionId = String(body.subscriptionId || "");
    const clientOrderId = `updcard_${subscriptionId || "none"}_${Date.now()}`.slice(0, 100);
    await savePendingOrder({
      clientOrderId,
      kind: "update_card",
      subscriptionId: subscriptionId || undefined,
      email: body.email,
      name: (body.name || `${body.firstName || ""} ${body.lastName || ""}`).trim() || undefined,
      firstName: body.firstName,
      lastName: body.lastName,
      amountCents: 100,            // nominal authorization; not captured
      currency: (body.currency || "USD").toUpperCase(),
      interval: "monthly",
      createdAt: new Date().toISOString(),
    });
    const result = await corepayCreateHppOrder({
      amountCents: 100,
      currency: (body.currency || "USD").toUpperCase(),
      mode: "AUTHORIZATION",
      successUrl: `${base}/patient-portal?cardUpdated=${encodeURIComponent(clientOrderId)}`,
      cancelUrl: `${base}/patient-portal?cardUpdate=cancel`,
      failedUrl: `${base}/patient-portal?cardUpdate=failed`,
      clientOrderId,
      orderDesc: "Update card on file",
      descriptor: "DripVitals",
      customer: { email: body.email, firstName: body.firstName, lastName: body.lastName, countryCode: "US" },
    });
    if (!result.ok || !result.redirectUrl) return json({ ok: false, error: result.error || "Could not start card update." }, 502);
    return json({ ok: true, url: result.redirectUrl });
  }

  if (action === "finalize") {
    const clientOrderId = String(body.clientOrderId || "");
    const pending = await getPendingOrder(clientOrderId);
    if (!pending || pending.kind !== "update_card") return json({ ok: false, error: "Unknown card-update request." }, 404);

    const order = await corepayGetOrder(clientOrderId);
    if (!order.ok) return json({ ok: false, error: order.error || "Couldn't verify the new card yet." }, 502);
    if (!order.approved || !order.transactionID) return json({ ok: false, error: "The card wasn't authorized. Please try again." });

    let updated = false;
    if (pending.subscriptionId) updated = await updateSubscriptionCard(pending.subscriptionId, order.transactionID, order.last4 || "");

    await record({
      id: `card_${order.transactionID}`, kind: "payment", provider: "corepay",
      email: pending.email || "", name: pending.name, paymentId: order.transactionID,
      planName: "Card on file updated", amountCents: 0, currency: pending.currency || "USD",
      status: "card_updated", last4: order.last4, createdAt: new Date().toISOString(),
    });

    return json({ ok: true, last4: order.last4, subscriptionUpdated: updated });
  }

  return json({ ok: false, error: "Unknown action." }, 400);
}
