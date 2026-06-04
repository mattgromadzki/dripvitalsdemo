import { Redis } from "@upstash/redis";

/**
 * Tracks intakes that have been started (lead captured) but not yet completed.
 * Stored in Upstash so it's visible across devices/sessions — the EMR reads it
 * to show in-progress intakes, and the cron job reads it to remind abandons.
 */
export interface PendingIntake {
  id: string;        // patient id (PT-xxxx)
  name: string;
  email: string;
  phone?: string;
  progress?: string; // human-readable step label, e.g. "Question 3 of 8"
  startedAt: number; // epoch ms — the 24h clock starts here
  updatedAt?: number;
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

async function read(id: string): Promise<PendingIntake | null> {
  const r = redis();
  return r ? parse(await r.hget(KEY, id)) : mem.get(id) || null;
}

async function write(rec: PendingIntake): Promise<void> {
  const r = redis();
  if (r) await r.hset(KEY, { [rec.id]: JSON.stringify(rec) });
  else mem.set(rec.id, rec);
}

/** Register the start of an intake. Keeps the original startedAt if it already exists. */
export async function registerStart(id: string, name: string, email: string, phone?: string): Promise<void> {
  const existing = await read(id);
  const rec: PendingIntake = existing
    ? { ...existing, name: name || existing.name, email: email || existing.email, phone: phone || existing.phone, updatedAt: Date.now() }
    : { id, name, email, phone, progress: "Contact captured", startedAt: Date.now(), updatedAt: Date.now(), completed: false, remindedAt: null };
  await write(rec);
}

/** Update how far the patient has gotten in the intake. */
export async function updateProgress(id: string, progress: string): Promise<void> {
  const existing = await read(id);
  if (!existing || existing.completed) return;
  await write({ ...existing, progress, updatedAt: Date.now() });
}

/** Mark an intake completed so it won't be reminded. */
export async function markComplete(id: string): Promise<void> {
  const existing = await read(id);
  if (!existing) return;
  await write({ ...existing, completed: true, progress: "Completed", updatedAt: Date.now() });
}

export async function markReminded(id: string): Promise<void> {
  const existing = await read(id);
  if (!existing) return;
  await write({ ...existing, remindedAt: Date.now() });
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
