import type Stripe from "stripe";
import { getStripe } from "@/lib/payments/stripe";
import { record, markPatientPaidByEmail } from "@/lib/payments/stripeLedger";
import { getTemplate, renderTemplate } from "@/lib/notify/templates";
import { sendEmail } from "@/lib/email/provider";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const money = (cents?: number | null, cur = "usd") =>
  cents == null ? "" : new Intl.NumberFormat("en-US", { style: "currency", currency: cur.toUpperCase() }).format(cents / 100);

export async function POST(req: Request) {
  const s = getStripe();
  if (!s) return Response.json({ ok: false, error: "Stripe not configured." }, { status: 400 });

  const sig = req.headers.get("stripe-signature") || "";
  const whsec = process.env.STRIPE_WEBHOOK_SECRET || "";
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = whsec ? s.webhooks.constructEvent(raw, sig, whsec) : (JSON.parse(raw) as Stripe.Event);
  } catch (e) {
    return Response.json({ ok: false, error: `Signature verification failed: ${e instanceof Error ? e.message : ""}` }, { status: 400 });
  }

  const now = new Date().toISOString();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const cs = event.data.object as Stripe.Checkout.Session;
        const email = cs.customer_email || cs.customer_details?.email || (cs.metadata?.email ?? "");
        const planName = cs.metadata?.planName || "Subscription";
        await record({
          id: `sub_${cs.subscription || cs.id}`, kind: "subscription", email,
          name: cs.customer_details?.name || undefined,
          patientId: cs.metadata?.patientId || undefined,
          customerId: typeof cs.customer === "string" ? cs.customer : cs.customer?.id,
          subscriptionId: typeof cs.subscription === "string" ? cs.subscription : undefined,
          planName, amountCents: cs.amount_total ?? undefined, currency: cs.currency || "usd",
          status: "active", createdAt: now,
        });
        if (email) await markPatientPaidByEmail(email, planName);
        break;
      }
      case "invoice.paid": {
        const inv = event.data.object as Stripe.Invoice & { subscription?: string | null; payment_intent?: string | null; charge?: string | null };
        const email = inv.customer_email || "";
        const planName = inv.lines?.data?.[0]?.description || "Subscription";
        await record({
          id: `pay_${inv.id}`, kind: "payment", email, name: inv.customer_name || undefined,
          customerId: typeof inv.customer === "string" ? inv.customer : undefined,
          subscriptionId: typeof inv.subscription === "string" ? inv.subscription : undefined,
          paymentIntentId: typeof inv.payment_intent === "string" ? inv.payment_intent : undefined,
          chargeId: typeof inv.charge === "string" ? inv.charge : undefined,
          planName, amountCents: inv.amount_paid, currency: inv.currency, status: "paid",
          receiptUrl: inv.hosted_invoice_url || undefined, createdAt: now,
        });
        // Branded receipt (in addition to Stripe's own receipt, if enabled).
        const tmpl = await getTemplate("payment_receipt");
        if (tmpl && email) {
          const data = { name: inv.customer_name || "there", amount: money(inv.amount_paid, inv.currency), plan: planName, date: new Date().toLocaleDateString(), receiptUrl: inv.hosted_invoice_url || "" };
          await sendEmail({ to: email, toName: inv.customer_name || undefined, subject: renderTemplate(tmpl.subject, data), html: renderTemplate(tmpl.html, data) });
        }
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice & { subscription?: string | null; payment_intent?: string | null; charge?: string | null };
        const email = inv.customer_email || "";
        const planName = inv.lines?.data?.[0]?.description || "Subscription";
        await record({
          id: `fail_${inv.id}_${inv.attempt_count || 0}`, kind: "payment", email, name: inv.customer_name || undefined,
          subscriptionId: typeof inv.subscription === "string" ? inv.subscription : undefined,
          planName, amountCents: inv.amount_due, currency: inv.currency, status: "failed", createdAt: now,
        });
        // Dunning email — Stripe also auto-retries (Smart Retries).
        const tmpl = await getTemplate("payment_failed");
        if (tmpl && email) {
          const data = { name: inv.customer_name || "there", amount: money(inv.amount_due, inv.currency), plan: planName };
          await sendEmail({ to: email, toName: inv.customer_name || undefined, subject: renderTemplate(tmpl.subject, data), html: renderTemplate(tmpl.html, data) });
        }
        break;
      }
      case "customer.subscription.deleted":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await record({
          id: `sub_${sub.id}`, kind: "subscription", email: (sub.metadata?.email ?? ""),
          patientId: sub.metadata?.patientId || undefined,
          customerId: typeof sub.customer === "string" ? sub.customer : undefined,
          subscriptionId: sub.id, planName: sub.metadata?.planName || "Subscription",
          status: sub.status, createdAt: now,
        });
        break;
      }
      case "charge.refunded": {
        const ch = event.data.object as Stripe.Charge;
        await record({
          id: `ref_${ch.id}`, kind: "refund", email: ch.billing_details?.email || ch.receipt_email || "",
          name: ch.billing_details?.name || undefined,
          customerId: typeof ch.customer === "string" ? ch.customer : undefined,
          amountCents: ch.amount_refunded, currency: ch.currency, status: "refunded",
          receiptUrl: ch.receipt_url || undefined, createdAt: now,
        });
        break;
      }
    }
  } catch {
    // Never 500 a webhook for an internal handling error — acknowledge receipt.
  }

  return Response.json({ received: true });
}
