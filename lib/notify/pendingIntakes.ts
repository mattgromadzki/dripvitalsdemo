import { Redis } from "@upstash/redis";

/**
 * Tracks intakes that have been started (lead captured) but not yet completed,
 * so a scheduled job can remind patients who abandon the questionnaire.
 * Stored in Upstash so the cron job can read it server-side.
 */
export interface PendingIntake {
  id: string;        // patient id (PT-xxxx)
  name: string;
  email: string;
  startedAt: number; // epoch ms — the 24h clock starts here
  completed: boolean;
  remindedAt: number | null;
}

const KEY = "intake:pending:v1";
const mem = new Map<string, PendingIntake>();

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function parse(v: unknown): PendingIntake | null {
  if (!v) return null;
  try { return typeof v === "string" ? JSON.parse(v) : (v as PendingIntake); } catch { return null; }
}

/** Register the start of an intake. Keeps the original startedAt if it already exists. */
export async function registerStart(id: string, name: string, email: string): Promise<void> {
  const r = redis();
  const existing = r ? parse(await r.hget(KEY, id)) : mem.get(id) || null;
  const rec: PendingIntake = existing
    ? { ...existing, name: name || existing.name, email: email || existing.email }
    : { id, name, email, startedAt: Date.now(), completed: false, remindedAt: null };
  if (r) await r.hset(KEY, { [id]: JSON.stringify(rec) });
  else mem.set(id, rec);
}

/** Mark an intake completed so it won't be reminded. */
export async function markComplete(id: string): Promise<void> {
  const r = redis();
  const existing = r ? parse(await r.hget(KEY, id)) : mem.get(id) || null;
  if (!existing) return;
  const rec = { ...existing, completed: true };
  if (r) await r.hset(KEY, { [id]: JSON.stringify(rec) });
  else mem.set(id, rec);
}

export async function markReminded(id: string): Promise<void> {
  const r = redis();
  const existing = r ? parse(await r.hget(KEY, id)) : mem.get(id) || null;
  if (!existing) return;
  const rec = { ...existing, remindedAt: Date.now() };
  if (r) await r.hset(KEY, { [id]: JSON.stringify(rec) });
  else mem.set(id, rec);
}

export async function listPending(): Promise<PendingIntake[]> {
  const r = redis();
  if (r) {
    const all = await r.hgetall<Record<string, unknown>>(KEY);
    if (!all) return [];
    return Object.values(all).map(parse).filter((x): x is PendingIntake => !!x);
  }
  return Array.from(mem.values());
}

export function isPersistent(): boolean {
  return !!((process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) && (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN));
}
