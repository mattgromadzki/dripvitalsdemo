import "server-only";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

/**
 * IP-based rate limiting for sensitive public endpoints (login, password reset,
 * intake). This complements the per-account lockout already in the login flow:
 * lockout protects a single account from repeated guesses, while this limits
 * volume per source IP — slowing brute-force spread across many accounts,
 * password-reset abuse, and intake spam.
 *
 * Backed by the same Upstash Redis used elsewhere. If Redis isn't configured the
 * limiter is a no-op (fails OPEN) so local/dev isn't blocked, and any limiter
 * error also fails open so real users are never locked out by a transient glitch.
 */
function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export type RateBucket = "login" | "reset" | "intake";

const cache = new Map<RateBucket, Ratelimit>();

function limiterFor(bucket: RateBucket): Ratelimit | null {
  const r = redis();
  if (!r) return null;
  if (!cache.has(bucket)) {
    const algo =
      bucket === "login" ? Ratelimit.slidingWindow(30, "10 m") :   // 30 / 10 min per IP (safe for shared office IP)
      bucket === "reset" ? Ratelimit.slidingWindow(10, "15 m") :   // 10 / 15 min per IP
      Ratelimit.slidingWindow(15, "10 m");                         // intake: 15 / 10 min per IP
    cache.set(bucket, new Ratelimit({ redis: r, limiter: algo, prefix: `rl:${bucket}`, analytics: false }));
  }
  return cache.get(bucket)!;
}

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

/**
 * Returns null when the request is allowed, or a 429 Response when over the
 * limit. Use at the top of a handler:
 *   const limited = await rateLimit(req, "login"); if (limited) return limited;
 */
export async function rateLimit(req: Request, bucket: RateBucket, key?: string): Promise<Response | null> {
  const limiter = limiterFor(bucket);
  if (!limiter) return null; // not configured → allow
  try {
    const id = key || clientIp(req);
    const { success, reset } = await limiter.limit(`${bucket}:${id}`);
    if (success) return null;
    const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    return new Response(
      JSON.stringify({ ok: false, error: "Too many attempts. Please wait a moment and try again." }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(retryAfter) } },
    );
  } catch {
    return null; // fail open — never lock out real users on a limiter error
  }
}
