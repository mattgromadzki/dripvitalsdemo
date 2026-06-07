import { record, list, markPatientPaidByEmail } from "@/lib/payments/stripeLedger";
import { getPendingOrder, patientByEmail, appendSubscription, buildSubscription } from "@/lib/payments/hppStore";
import { getTemplate, renderTemplate } from "@/lib/notify/templates";
import { sendEmail } from "@/lib/email/provider";

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

      const pending = await getPendingOrder(String(d.clientOrderId || ""));
      const email = pending?.email || "";
      const amountCents = pending?.amountCents || Math.round(Number(d.amount || 0) * 100);
      const last4 = String(d.cardNumber || "").replace(/[^0-9*]/g, "").slice(-4);
      const planName = pending?.planName || "Treatment plan";
      const currency = pending?.currency || "USD";

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
        await sendEmail({ to: email, toName: patientName || undefined, subject: renderTemplate(tmpl.subject, data), html: renderTemplate(tmpl.html, data) });
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
