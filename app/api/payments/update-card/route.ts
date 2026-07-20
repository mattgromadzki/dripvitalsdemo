import { corepayConfigured, corepayCreateHppOrder, corepayGetOrder } from "@/lib/payments/corepay";
import { savePendingOrder, getPendingOrder, updateSubscriptionCard, subscriptionOwnedBy } from "@/lib/payments/hppStore";
import { record } from "@/lib/payments/stripeLedger";
import { appUrl } from "@/lib/payments/stripe";
import { getVerifiedPatientSession } from "@/lib/auth/patientSession";

export const dynamic = "force-dynamic";

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * Lets a signed-in patient replace the card backing their subscription, PCI-safely.
 * Identity comes from the patient session cookie (not the client body), and the
 * target subscription must belong to that patient — so one patient can't touch
 * another's card.
 *
 *   begin    → opens NetValve's hosted page in AUTHORIZATION mode (validates the
 *              card without a real charge) and returns a redirect URL.
 *   finalize → reads the order back via /order, captures the new transaction id +
 *              card, and repoints the subscription's billing token.
 */
export async function POST(req: Request) {
  const sess = await getVerifiedPatientSession(req);
  if (!sess) return json({ ok: false, error: "Please sign in to update your card." }, 401);
  if (!corepayConfigured()) return json({ ok: false, error: "Card updates aren't available right now." }, 400);

  const body = await req.json().catch(() => ({}));
  const action = body.action || "begin";
  const base = appUrl(req);

  if (action === "begin") {
    const subscriptionId = String(body.subscriptionId || "");
    // If a subscription is named, it must belong to this patient.
    if (subscriptionId && !(await subscriptionOwnedBy(subscriptionId, sess.pid))) {
      return json({ ok: false, error: "That subscription isn't on your account." }, 403);
    }
    const [firstName, ...rest] = (sess.name || "").split(/\s+/);
    const clientOrderId = `updcard_${subscriptionId || "none"}_${Date.now()}`.slice(0, 100);
    await savePendingOrder({
      clientOrderId,
      kind: "update_card",
      subscriptionId: subscriptionId || undefined,
      ownerPid: sess.pid,
      email: sess.email,
      name: sess.name,
      firstName: firstName || undefined,
      lastName: rest.join(" ") || undefined,
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
      customer: { email: sess.email, firstName: firstName || undefined, lastName: rest.join(" ") || undefined, countryCode: "US" },
    });
    if (!result.ok || !result.redirectUrl) return json({ ok: false, error: result.error || "Could not start card update." }, 502);
    return json({ ok: true, url: result.redirectUrl });
  }

  if (action === "finalize") {
    const clientOrderId = String(body.clientOrderId || "");
    const pending = await getPendingOrder(clientOrderId);
    if (!pending || pending.kind !== "update_card") return json({ ok: false, error: "Unknown card-update request." }, 404);
    // The finalize caller must be the patient who started it.
    if (pending.ownerPid && pending.ownerPid !== sess.pid) return json({ ok: false, error: "Not your card-update request." }, 403);

    const order = await corepayGetOrder(clientOrderId);
    if (!order.ok) return json({ ok: false, error: order.error || "Couldn't verify the new card yet." }, 502);
    if (!order.approved || !order.transactionID) return json({ ok: false, error: "The card wasn't authorized. Please try again." });

    let updated = false;
    if (pending.subscriptionId && (await subscriptionOwnedBy(pending.subscriptionId, sess.pid))) {
      updated = await updateSubscriptionCard(pending.subscriptionId, order.transactionID, order.last4 || "");
    }

    await record({
      id: `card_${order.transactionID}`, kind: "payment", provider: "corepay",
      email: sess.email, name: sess.name, patientId: sess.pid, paymentId: order.transactionID,
      planName: "Card on file updated", amountCents: 0, currency: pending.currency || "USD",
      status: "card_updated", last4: order.last4, createdAt: new Date().toISOString(),
    });

    return json({ ok: true, last4: order.last4, subscriptionUpdated: updated });
  }

  return json({ ok: false, error: "Unknown action." }, 400);
}
