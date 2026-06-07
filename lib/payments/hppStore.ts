import { Redis } from "@upstash/redis";
import { advance } from "@/lib/subscriptions/util";
import type { Subscription } from "@/lib/subscriptions/types";

/**
 * Bridges the Hosted Payment Page redirect flow with the rest of the app.
 *
 * When the intake checkout starts an HPP order we stash a PendingOrder keyed by
 * clientOrderId (everything the webhook will need that isn't echoed back by the
 * gateway). When NetValve later calls our webhook with PURCHASED, we look the
 * order back up, mark the patient paid, and append a real Subscription (storing
 * the NetValve transactionID as the token so the recurring cron can /rebill it).
 *
 * Falls back to in-memory maps when Upstash isn't configured (single-instance dev).
 */

const PENDING_KEY = "corepay:pending:v1";
const SUBS_KEY = "store:subscriptions"; // same key the subscriptions store persists to

export interface PendingOrder {
  clientOrderId: string;
  kind?: "checkout" | "update_card"; // default checkout
  subscriptionId?: string;           // for update_card
  email?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  planName?: string;
  planId?: string;
  med?: string;
  amountCents: number;
  currency: string;
  interval: "monthly" | "quarterly";
  treatmentId?: number | null;
  createdAt: string;
}

const memPending = new Map<string, PendingOrder>();

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function savePendingOrder(o: PendingOrder): Promise<void> {
  const r = redis();
  if (r) await r.hset(PENDING_KEY, { [o.clientOrderId]: JSON.stringify(o) });
  else memPending.set(o.clientOrderId, o);
}

export async function getPendingOrder(clientOrderId: string): Promise<PendingOrder | null> {
  if (!clientOrderId) return null;
  const r = redis();
  if (!r) return memPending.get(clientOrderId) || null;
  const v = await r.hget(PENDING_KEY, clientOrderId);
  if (!v) return null;
  try { return typeof v === "string" ? JSON.parse(v) : (v as PendingOrder); } catch { return null; }
}

/** Find a patient (id + display name) by email from the persisted patients store. */
export async function patientByEmail(email?: string): Promise<{ id?: string; name?: string }> {
  const r = redis();
  if (!r || !email) return {};
  const v = await r.get("store:patients");
  const arr = typeof v === "string" ? JSON.parse(v) : v;
  if (!Array.isArray(arr)) return {};
  const lc = email.toLowerCase();
  const p = arr.find((x: { email?: string }) => (x?.email || "").toLowerCase() === lc) as { id?: string; name?: string } | undefined;
  return p ? { id: p.id, name: p.name } : {};
}

/** Append a Subscription to the shared subscriptions store (last-write-wins). */
export async function appendSubscription(sub: Subscription): Promise<void> {
  const r = redis();
  if (!r) return; // demo without Upstash: nothing durable to append to
  const v = await r.get(SUBS_KEY);
  const arr: Subscription[] = Array.isArray(v) ? v : typeof v === "string" ? JSON.parse(v) : [];
  if (arr.some((s) => s.id === sub.id)) return; // idempotent
  arr.unshift(sub);
  await r.set(SUBS_KEY, JSON.stringify(arr));
}

/** Repoint a subscription to a new card/token (used by "update card on file").
   Clears past-due dunning state since the card has been refreshed. */
export async function updateSubscriptionCard(subscriptionId: string, token: string, last4: string): Promise<boolean> {
  const r = redis();
  if (!r) return false;
  const v = await r.get(SUBS_KEY);
  const arr: Subscription[] = Array.isArray(v) ? v : typeof v === "string" ? JSON.parse(v) : [];
  const idx = arr.findIndex((s) => s.id === subscriptionId);
  if (idx < 0) return false;
  arr[idx] = {
    ...arr[idx],
    paymentToken: token,
    cardLast4: last4 || arr[idx].cardLast4,
    failedAttempts: 0,
    status: arr[idx].status === "past_due" ? "active" : arr[idx].status,
  };
  await r.set(SUBS_KEY, JSON.stringify(arr));
  return true;
}
export function buildSubscription(opts: {
  transactionId: string;
  pending: PendingOrder | null;
  patientId?: string;
  patientName?: string;
  amountCents: number;
  last4?: string;
}): Subscription {
  const now = new Date().toISOString();
  const interval = opts.pending?.interval === "quarterly" ? "quarterly" : "monthly";
  const planName = opts.pending?.planName || "Treatment plan";
  return {
    id: `SUB-${opts.transactionId}`,
    patientId: opts.patientId,
    patientName: opts.patientName || opts.pending?.name || "New patient",
    planId: opts.pending?.planId || `plan-${opts.transactionId}`,
    planName,
    med: opts.pending?.med || planName,
    interval,
    amountCents: opts.amountCents,
    status: "active",
    startedAt: now,
    nextBillingDate: advance(now, interval),
    cardLast4: opts.last4 || "",
    paymentToken: opts.transactionId, // NetValve transactionID — used by /rebill
    failedAttempts: 0,
    cycles: [{ id: `${opts.transactionId}-1`, date: now, amountCents: opts.amountCents, status: "paid", paymentId: opts.transactionId }],
  };
}
