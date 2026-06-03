import { Redis } from "@upstash/redis";
import type { InboundSms } from "./types";

/**
 * Storage for inbound SMS (patient replies received via the Twilio webhook).
 *
 * On Vercel, serverless functions are stateless — the request that RECEIVES a
 * reply (the webhook) and the request that READS replies (the SMS page polling)
 * usually run on different instances, so an in-memory array would not be shared.
 * Therefore production requires a real store. We use Upstash Redis, which is what
 * Vercel KV is built on, so this works with EITHER:
 *   - Vercel KV / Upstash integration  → KV_REST_API_URL + KV_REST_API_TOKEN
 *   - Upstash directly                 → UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *
 * If neither is configured, we fall back to an in-memory list. That works for
 * local `npm run dev` (single process) but NOT reliably on Vercel.
 */

const KEY = "sms:inbound";
const MAX = 500;

// Local-dev fallback only (not shared across serverless instances).
let mem: InboundSms[] = [];

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function isPersistent(): boolean {
  return redis() !== null;
}

export async function addInbound(msg: InboundSms): Promise<void> {
  const r = redis();
  if (r) {
    await r.lpush(KEY, JSON.stringify(msg)); // newest first
    await r.ltrim(KEY, 0, MAX - 1);
  } else {
    mem.unshift(msg);
    mem = mem.slice(0, MAX);
  }
}

export async function listInbound(limit = 200): Promise<InboundSms[]> {
  const r = redis();
  if (r) {
    const raw = await r.lrange<string | InboundSms>(KEY, 0, limit - 1);
    return raw.map((x) => (typeof x === "string" ? (JSON.parse(x) as InboundSms) : x));
  }
  return mem.slice(0, limit);
}
