import "server-only";
import { Redis } from "@upstash/redis";

/**
 * Lightweight realtime "signal bus" backed by Redis.
 *
 * Each writable domain has a version counter (`ver:<domain>`) that is bumped on
 * every write. Clients check these counters on a cheap heartbeat and only fetch
 * the actual data from Postgres when a counter changes. This keeps the database
 * asleep while data is static (Neon scale-to-zero) even with tabs open, and
 * lets updates propagate in ~seconds without ever polling the database itself.
 *
 * Redis here is the signal carrier only — it never holds PHI and is independent
 * of whichever backend (Postgres/KV) actually stores the data.
 */
function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function signalsEnabled(): boolean {
  return !!(
    (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) &&
    (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN)
  );
}

/** Bump a domain's version so watchers know to refetch. No-op without Redis. */
export async function bumpVersion(domain: string): Promise<void> {
  const r = redis();
  if (!r) return;
  try { await r.incr(`ver:${domain}`); } catch { /* non-fatal */ }
}

/** Read current versions for the given domains (defaults to 0). */
export async function getVersions(domains: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const r = redis();
  if (!r || domains.length === 0) return out;
  try {
    const keys = domains.map((d) => `ver:${d}`);
    const vals = (await r.mget<(number | string | null)[]>(...keys)) || [];
    domains.forEach((d, i) => {
      const v = vals[i];
      out[d] = typeof v === "number" ? v : v ? Number(v) || 0 : 0;
    });
  } catch { /* non-fatal */ }
  return out;
}
