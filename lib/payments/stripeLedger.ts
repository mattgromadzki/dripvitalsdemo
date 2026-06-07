import { Redis } from "@upstash/redis";

/**
 * Server-side record of real Stripe activity (subscriptions, payments, refunds),
 * written by the webhook and read by the admin Payments screen. Kept separate
 * from the demo/mock subscription store so live data is never confused with seeds.
 */
export interface LedgerEntry {
  id: string;                  // unique: invoice id / refund id / subscription id / session id
  kind: "subscription" | "payment" | "refund";
  provider?: string;           // "corepay" | "stripe" | "mock" …
  email: string;
  name?: string;
  patientId?: string;
  customerId?: string;
  subscriptionId?: string;
  paymentId?: string;          // gateway transaction id (for refunds)
  paymentIntentId?: string;
  chargeId?: string;
  planName?: string;
  amountCents?: number;
  currency?: string;
  status?: string;             // active, paid, past_due, canceled, refunded, failed…
  last4?: string;
  cardBrand?: string;
  receiptUrl?: string;
  createdAt: string;           // ISO
}

const KEY = "stripe:ledger:v1";
const mem = new Map<string, LedgerEntry>();

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}
function parse(v: unknown): LedgerEntry | null {
  if (!v) return null;
  try { return typeof v === "string" ? JSON.parse(v) : (v as LedgerEntry); } catch { return null; }
}

export async function record(entry: LedgerEntry): Promise<void> {
  const r = redis();
  if (r) await r.hset(KEY, { [entry.id]: JSON.stringify(entry) });
  else mem.set(entry.id, entry);
}

export async function list(): Promise<LedgerEntry[]> {
  const r = redis();
  let entries: LedgerEntry[];
  if (r) {
    const all = await r.hgetall<Record<string, unknown>>(KEY);
    entries = all ? Object.values(all).map(parse).filter((x): x is LedgerEntry => !!x) : [];
  } else {
    entries = Array.from(mem.values());
  }
  return entries.sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}

export function isPersistent(): boolean {
  return !!((process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) && (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN));
}

/** Look up a patient's email from the persisted store, by id then by name. */
export async function patientEmail(patientId?: string, name?: string): Promise<string> {
  const r = redis();
  if (!r) return "";
  const v = await r.get("store:patients");
  const arr = typeof v === "string" ? JSON.parse(v) : v;
  if (!Array.isArray(arr)) return "";
  const byId = patientId ? arr.find((p: { id?: string }) => p?.id === patientId) : null;
  const byName = !byId && name ? arr.find((p: { name?: string }) => (p?.name || "").toLowerCase() === name.toLowerCase()) : null;
  return (byId?.email || byName?.email || "") as string;
}

/**
 * Best-effort: flip the matching patient (by email) to an active/paying state and
 * stamp their plan, so the EMR reflects a real subscription started via Checkout.
 */
export async function markPatientPaidByEmail(email: string, planName?: string): Promise<void> {
  const r = redis();
  if (!r || !email) return;
  const v = await r.get("store:patients");
  const arr = typeof v === "string" ? JSON.parse(v) : v;
  if (!Array.isArray(arr)) return;
  const lc = email.toLowerCase();
  let changed = false;
  for (const p of arr) {
    if ((p?.email || "").toLowerCase() === lc) {
      p.lifecycle = "active";
      p.status = "active";
      if (planName) p.plan = planName;
      p.sub = "active";
      changed = true;
    }
  }
  if (changed) await r.set("store:patients", JSON.stringify(arr));
}
