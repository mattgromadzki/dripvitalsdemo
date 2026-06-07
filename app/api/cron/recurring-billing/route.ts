import { Redis } from "@upstash/redis";
import { charge } from "@/lib/payments/provider";
import { advance, money } from "@/lib/subscriptions/util";
import { record, patientEmail } from "@/lib/payments/stripeLedger";
import { getTemplate, renderTemplate } from "@/lib/notify/templates";
import { sendEmail } from "@/lib/email/provider";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 4;       // give up (cancel) after this many failures
const RETRY_DAYS = 2;         // space out dunning retries

interface Cycle { id: string; date: string; amountCents: number; status: string; paymentId?: string; }
interface Sub {
  id: string; patientId?: string; patientName: string; planName: string;
  interval: "monthly" | "quarterly"; amountCents: number; status: string;
  nextBillingDate: string; paymentToken: string; failedAttempts: number; cycles: Cycle[];
}

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// Daily (Vercel Cron). Charges subscriptions due today through the active payment
// provider, advancing the billing date on success and running dunning (retry +
// failed-payment email) on decline. Sends a receipt email on each successful charge.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const r = redis();
  if (!r) return Response.json({ ok: false, error: "No persistent store (Upstash) configured." }, { status: 200 });

  const v = await r.get("store:subscriptions");
  const subs = (typeof v === "string" ? JSON.parse(v) : v) as Sub[] | null;
  if (!Array.isArray(subs)) return Response.json({ ok: true, due: 0, charged: 0, failed: 0 });

  const now = Date.now();
  const receipt = await getTemplate("payment_receipt");
  const dunning = await getTemplate("payment_failed");
  let due = 0, charged = 0, failed = 0;

  for (const s of subs) {
    if (!["active", "past_due", "trialing"].includes(s.status)) continue;
    if ((Date.parse(s.nextBillingDate) || 0) > now) continue;
    due++;

    const res = await charge({ sourceId: s.paymentToken, amountCents: s.amountCents, currency: "USD", referenceId: s.id, note: s.planName });
    const email = await patientEmail(s.patientId, s.patientName);
    const stamp = new Date().toISOString();

    if (res.ok) {
      s.cycles = [...(s.cycles || []), { id: `${s.id}-${now.toString(36)}`, date: stamp, amountCents: s.amountCents, status: "paid", paymentId: res.paymentId }];
      s.status = "active"; s.failedAttempts = 0;
      s.nextBillingDate = advance(s.nextBillingDate, s.interval);
      charged++;
      await record({ id: `pay_${res.paymentId || s.id + now}`, kind: "payment", provider: res.provider, paymentId: res.paymentId, email, name: s.patientName, patientId: s.patientId, planName: s.planName, amountCents: s.amountCents, currency: "usd", status: "paid", createdAt: stamp });
      if (email && receipt) {
        const d = { name: s.patientName, amount: money(s.amountCents), plan: s.planName, date: new Date().toLocaleDateString(), receiptUrl: "" };
        await sendEmail({ to: email, toName: s.patientName, subject: renderTemplate(receipt.subject, d), html: renderTemplate(receipt.html, d) });
      }
    } else {
      s.failedAttempts = (s.failedAttempts || 0) + 1;
      s.cycles = [...(s.cycles || []), { id: `${s.id}-${now.toString(36)}`, date: stamp, amountCents: s.amountCents, status: "failed" }];
      if (s.failedAttempts >= MAX_ATTEMPTS) { s.status = "canceled"; }
      else { s.status = "past_due"; s.nextBillingDate = new Date(now + RETRY_DAYS * DAY_MS).toISOString(); }
      failed++;
      await record({ id: `fail_${s.id}_${now}`, kind: "payment", provider: res.provider, email, name: s.patientName, patientId: s.patientId, planName: s.planName, amountCents: s.amountCents, currency: "usd", status: "failed", createdAt: stamp });
      if (email && dunning) {
        const d = { name: s.patientName, amount: money(s.amountCents), plan: s.planName };
        await sendEmail({ to: email, toName: s.patientName, subject: renderTemplate(dunning.subject, d), html: renderTemplate(dunning.html, d) });
      }
    }
  }

  await r.set("store:subscriptions", JSON.stringify(subs));
  return Response.json({ ok: true, total: subs.length, due, charged, failed });
}
