import "server-only";
import { Redis } from "@upstash/redis";

/**
 * Per-day outreach-email counter (Upstash). Backs the dispatcher's daily send
 * cap so a large list is paced over many days — protecting sender reputation
 * (warm-up) and keeping monthly volume under the SendGrid plan allotment.
 */
function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// UTC day bucket. Cron/dispatch run in UTC on Vercel.
function dayKey(): string {
  const d = new Date();
  return `farming:sent:${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export async function sentToday(): Promise<number> {
  const r = redis(); if (!r) return 0;
  const v = await r.get(dayKey());
  const n = typeof v === "number" ? v : parseInt(String(v ?? "0"), 10);
  return Number.isFinite(n) ? n : 0;
}

export async function addSentToday(n: number): Promise<void> {
  const r = redis(); if (!r || n <= 0) return;
  const key = dayKey();
  await r.incrby(key, n);
  await r.expire(key, 60 * 60 * 72); // keep 3 days, then auto-clear
}
