import { Redis } from "@upstash/redis";

/**
 * Tracks which license-expiration reminders have already been sent, so the
 * daily cron emails each threshold (60-day, 30-day) only once per license.
 *
 * The dedup key includes the license's expiration date, so when a doctor
 * RENEWS (expDate changes), the new license has a fresh key and a far-future
 * date — no reminder fires. That naturally implements "again at 30 days if not
 * renewed."
 */

const SENT_KEY = "license:reminders:v1";
const mem = new Map<string, number>();

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/** key = `${doctorId}:${state}:${expDate}:${threshold}` */
export async function wasSent(key: string): Promise<boolean> {
  const r = redis();
  if (r) { const v = await r.hget(SENT_KEY, key); return v != null; }
  return mem.has(key);
}

export async function markSent(key: string): Promise<void> {
  const r = redis();
  if (r) await r.hset(SENT_KEY, { [key]: Date.now() });
  else mem.set(key, Date.now());
}

/** Read the in-house doctors from the same place the EMR persists them. */
export interface StoredLicense { state: string; number: string; expDate: string; }
export interface StoredDoctor {
  id: string; first: string; last: string; title?: string;
  email: string; active: boolean; licenses: StoredLicense[];
}

export async function loadDoctors(): Promise<StoredDoctor[]> {
  const r = redis();
  if (!r) return [];
  const v = await r.get("store:doctors");
  const arr = typeof v === "string" ? JSON.parse(v) : v;
  return Array.isArray(arr) ? (arr as StoredDoctor[]) : [];
}

export function isPersistent(): boolean {
  return !!((process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) && (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN));
}
