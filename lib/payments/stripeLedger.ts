import { Redis } from "@upstash/redis";
import { listPatients, savePatient } from "@/lib/crm/patients";

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
  let arr: Awaited<ReturnType<typeof listPatients>>;
  try { arr = await listPatients(); } catch { return ""; }
  if (!Array.isArray(arr) || !arr.length) return "";
  const byId = patientId ? arr.find((p) => p?.id === patientId) : null;
  const byName = !byId && name ? arr.find((p) => (p?.name || "").toLowerCase() === name.toLowerCase()) : null;
  return (byId?.email || byName?.email || "") as string;
}

/**
 * Best-effort: flip the matching patient (by email) to an active/paying state and
 * stamp their plan, so the EMR reflects a real subscription started via Checkout.
 */
export async function markPatientPaidByEmail(email: string, planName?: string): Promise<void> {
  if (!email) return;
  let arr: Awaited<ReturnType<typeof listPatients>>;
  try { arr = await listPatients(); } catch { return; }
  if (!Array.isArray(arr) || !arr.length) return;
  const lc = email.toLowerCase();
  for (const p of arr) {
    if ((p?.email || "").toLowerCase() !== lc) continue;
    p.status = "active";
    p.lifecycle = "active_treatment";
    if (planName) p.plan = planName;
    try { await savePatient(p); } catch { /* best-effort */ }
  }
}
