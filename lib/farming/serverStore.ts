import "server-only";
import { Redis } from "@upstash/redis";
import { emrUsesPostgres } from "@/lib/db/client";
import { dbGetDomain, dbSetDomain } from "@/lib/db/store";
import { bumpVersion } from "@/lib/realtime/signal";

// Server-side read/write for the persisted store domains, mirroring the backend
// selection in app/api/store/[domain]/route.ts (Postgres → Redis → in-memory).
// Used by the cron dispatcher, the unsubscribe route, and SMS STOP handling —
// all of which must touch the SAME blobs the client stores persist to.

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const mem = new Map<string, unknown>();

export async function readDomain<T = unknown>(domain: string): Promise<T | null> {
  try {
    if (emrUsesPostgres()) return ((await dbGetDomain(domain)) as T) ?? null;
    const r = redis();
    if (r) { const v = await r.get(`store:${domain}`); return (typeof v === "string" ? JSON.parse(v) : (v ?? null)) as T | null; }
    return (mem.get(domain) as T) ?? null;
  } catch {
    return null;
  }
}

export async function writeDomain(domain: string, data: unknown): Promise<void> {
  try {
    if (emrUsesPostgres()) await dbSetDomain(domain, data);
    else {
      const r = redis();
      if (r) await r.set(`store:${domain}`, JSON.stringify(data));
      else mem.set(domain, data);
    }
    await bumpVersion(domain); // nudge any open client to refetch
  } catch {
    /* best-effort: a failed mirror shouldn't crash the caller */
  }
}
