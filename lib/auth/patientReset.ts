import "server-only";
import { Redis } from "@upstash/redis";
import { randomBytes } from "crypto";

/**
 * Single-use, expiring password-reset tokens for patients. The token is emailed
 * as part of a portal link (?reset=<token>); the server maps token -> email so
 * the link never needs to carry the email itself. Tokens are deleted on use.
 */
const KEY = "patient:reset:v1";
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function createResetToken(email: string, ttlMs: number = DEFAULT_TTL_MS): Promise<string | null> {
  const r = redis();
  if (!r) return null;
  const token = randomBytes(24).toString("hex");
  await r.hset(KEY, { [token]: JSON.stringify({ email: email.trim().toLowerCase(), exp: Date.now() + ttlMs }) });
  return token;
}

/** Returns the associated email if the token is valid + unexpired, else null. Always single-use. */
export async function consumeResetToken(token: string): Promise<string | null> {
  const r = redis();
  if (!r || !token) return null;
  const raw = await r.hget(KEY, token);
  await r.hdel(KEY, token); // single-use: burn it regardless of validity
  if (!raw) return null;
  let p: { email?: string; exp?: number };
  try { p = typeof raw === "string" ? JSON.parse(raw) : (raw as { email?: string; exp?: number }); } catch { return null; }
  if (!p?.email || !p?.exp || Date.now() > p.exp) return null;
  return p.email;
}
