import { record, list, markPatientPaidByEmail } from "@/lib/payments/stripeLedger";
import { getPendingOrder, patientByEmail, appendSubscription, buildSubscription, updateSubscriptionCard } from "@/lib/payments/hppStore";
import { corepayConfigured, corepayInquiry } from "@/lib/payments/corepay";
import { getTemplate, renderTemplate } from "@/lib/notify/templates";
import { sendEmail, ordersFrom } from "@/lib/email/provider";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const money = (cents?: number, cur = "USD") =>
  cents == null ? "" : new Intl.NumberFormat("en-US", { style: "currency", currency: cur.toUpperCase() }).format(cents / 100);

interface WebhookData {
  transactionId?: number | string;
  clientOrderId?: string;
  amount?: number;
  cardNumber?: string;
  cardType?: string;
  responseCodeType?: string;
  responseCode?: string;
}

/**
 * NetValve / CorePay webhook. Configure your callback URL in the NetValve
 * dashboard to point here (optionally with ?key=<COREPAY_WEBHOOK_SECRET>).
 * Delivery is "at-least-once", so this handler is idempotent — duplicate
 * PURCHASED events for the same transactionId are ignored.
 */
export async function POST(req: Request) {
  // Optional shared-secret gate (set COREPAY_WEBHOOK_SECRET and append ?key= to the callback URL).
  const secret = process.env.COREPAY_WEBHOOK_SECRET;
  if (secret) {
    const provided = new URL(req.url).searchParams.get("key") || req.headers.get("x-webhook-key") || "";
    if (provided !== secret) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const raw = await req.text();
  let evt: { eventName?: string; data?: WebhookData };
  try { evt = JSON.parse(raw); } catch { return Response.json({ ok: true }); } // ack malformed so it isn't retried forever

  const eventName = evt?.eventName;
  const d: WebhookData = evt?.data || {};
  const txId = d.transactionId != null ? String(d.transactionId) : "";
  const now = new Date().toISOString();

  try {
    if (eventName === "PURCHASED") {
      if (!txId) return Response.json({ ok: true });

      // Idempotency: if we've already recorded this payment, do nothing (no dup email/sub).
      const already = (await list()).some((e) => e.id === `pay_${txId}`);
      if (already) return Response.json({ ok: true, duplicate: true });

      // Re-verify against the gateway before trusting the event. A spoofed or replayed
      // callback can't fabricate an approved transaction this way. Skipped only when the
      // gateway isn't configured (e.g. a local demo posting a test event).
      let verifiedCard = "";
      if (corepayConfigured()) {
        const inq = await corepayInquiry(txId);
        if (!inq.ok) {
          // Couldn't reach the gateway — 500 so NetValve retries later (handler is idempotent).
          return Response.json({ ok: false, error: inq.error || "verification unavailable" }, { status: 500 });
        }
        if (!inq.approved) {
          // Gateway says this transaction is NOT approved — never create a subscription.
          await record({ id: `unverified_${txId}`, kind: "payment", provider: "corepay", email: "", paymentId: txId, status: "unverified", createdAt: now });
          return Response.json({ ok: true, unverified: true });
        }
        verifiedCard = inq.cardNumber || "";
      }

      const pending = await getPendingOrder(String(d.clientOrderId || ""));
      const email = pending?.email || "";
      const amountCents = pending?.amountCents || Math.round(Number(d.amount || 0) * 100);
      const last4 = String(d.cardNumber || verifiedCard || "").replace(/[^0-9*]/g, "").slice(-4);
      const planName = pending?.planName || "Treatment plan";
      const currency = pending?.currency || "USD";

      // Card-update flow: repoint the subscription's token instead of creating one.
      if (pending?.kind === "update_card") {
        if (pending.subscriptionId) await updateSubscriptionCard(pending.subscriptionId, txId, last4);
        await record({ id: `card_${txId}`, kind: "payment", provider: "corepay", email, name: pending.name, paymentId: txId, planName: "Card on file updated", amountCents: 0, currency, status: "card_updated", last4, createdAt: now });
        return Response.json({ ok: true, cardUpdated: true });
      }

      if (email) await markPatientPaidByEmail(email, planName);
      const { id: patientId, name: patientName } = await patientByEmail(email);

      const sub = buildSubscription({ transactionId: txId, pending, patientId, patientName, amountCents, last4 });
      await appendSubscription(sub);

      await record({ id: `sub_${txId}`, kind: "subscription", provider: "corepay", email, name: patientName || pending?.name,
        patientId, planName, amountCents, currency, status: "active", last4, createdAt: now });
      await record({ id: `pay_${txId}`, kind: "payment", provider: "corepay", email, name: patientName || pending?.name,
        patientId, paymentId: txId, planName, amountCents, currency, status: "paid", last4, createdAt: now });

      const tmpl = await getTemplate("payment_receipt");
      if (tmpl && email) {
        const data = { name: patientName || pending?.firstName || "there", amount: money(amountCents, currency), plan: planName, date: new Date().toLocaleDateString(), receiptUrl: "" };
        await sendEmail({ to: email, toName: patientName || undefined, subject: renderTemplate(tmpl.subject, data), html: renderTemplate(tmpl.html, data), from: ordersFrom() });
      }
      return Response.json({ ok: true });
    }

    if (eventName === "PURCHASE_FAILED") {
      const pending = await getPendingOrder(String(d.clientOrderId || ""));
      await record({ id: `fail_${txId || Date.now()}`, kind: "payment", provider: "corepay", email: pending?.email || "",
        planName: pending?.planName, amountCents: pending?.amountCents, currency: pending?.currency || "USD", status: "failed", createdAt: now });
      return Response.json({ ok: true });
    }

    return Response.json({ ok: true }); // ack any other event types
  } catch (e) {
    // Returning non-200 makes NetValve retry; our handler is idempotent, so that's safe.
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
