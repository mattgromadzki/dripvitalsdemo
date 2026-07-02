import crypto from "crypto";
import { Redis } from "@upstash/redis";

/**
 * One-time password-reset tokens. The raw token is emailed to the user; only its
 * SHA-256 hash is stored, with a short TTL, and it's deleted on use (single-use).
 * Falls back to an in-memory map when Upstash isn't configured.
 */

const PREFIX = "auth:reset:v1:";
const TTL_MIN = 30;

interface TokenRec { email: string; exp: number; }
const mem = new Map<string, TokenRec>();

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}
const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

export async function createResetToken(email: string, ttlMinutes: number = TTL_MIN): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const rec: TokenRec = { email: email.trim().toLowerCase(), exp: Date.now() + ttlMinutes * 60_000 };
  const k = PREFIX + hash(token);
  const r = redis();
  if (r) await r.set(k, JSON.stringify(rec), { ex: ttlMinutes * 60 });
  else mem.set(k, rec);
  return token;
}

/** Validate against the given email, and consume (delete) on success. */
export async function consumeResetToken(token: string, email: string): Promise<boolean> {
  if (!token || !email) return false;
  const k = PREFIX + hash(token);
  const r = redis();
  let rec: TokenRec | null = null;
  if (r) {
    const v = await r.get(k);
    rec = v ? (typeof v === "string" ? JSON.parse(v) : (v as TokenRec)) : null;
  } else {
    rec = mem.get(k) || null;
  }
  if (!rec || rec.exp < Date.now() || rec.email !== email.trim().toLowerCase()) return false;
  if (r) await r.del(k); else mem.delete(k);
  return true;
}
