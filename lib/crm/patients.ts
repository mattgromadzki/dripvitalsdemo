import { Redis } from "@upstash/redis";
import type { Patient } from "@/lib/types";
import { hasDb } from "@/lib/db/client";
import { dbSavePatient, dbListPatients } from "@/lib/db/store";

/**
 * Full patient profiles created/updated during intake, stored in Upstash so they
 * appear in the CRM roster + chart across devices immediately (not just in the
 * browser session that ran the intake). Seeded demo patients stay in-memory;
 * only intake-created patients live here.
 */
const KEY = "crm:patients:v1";

/**
 * Atomically allocate the next patient number (PT-1001, PT-1002, …).
 *
 * IDs must be issued HERE, on the server — never computed in the browser. The
 * public intake page starts with an empty local roster, so client-side "max+1"
 * math hands every visitor the same number and the CRM upsert then overwrites
 * the earlier patient (real data loss). Redis INCR is atomic, so two intakes
 * completing in the same second still get distinct ids. The counter is seeded
 * once from the highest existing id (never below the 1001 floor).
 */
const SEQ_KEY = "crm:patient-seq:v1";
export async function allocatePatientId(): Promise<string> {
  const highestExisting = async (): Promise<number> => {
    let max = 1000; // numbering floor: first allocated id is PT-1001
    try {
      const all = await listPatients();
      for (const p of all) {
        const m = /^PT-(\d+)$/.exec(p.id || "");
        if (m) max = Math.max(max, parseInt(m[1], 10));
      }
    } catch { /* fall back to the floor */ }
    return max;
  };
  const r = redis();
  if (r) {
    if (!(await r.exists(SEQ_KEY))) {
      // NX so a concurrent initializer can't reset an already-seeded counter.
      await r.set(SEQ_KEY, await highestExisting(), { nx: true });
    }
    const n = await r.incr(SEQ_KEY);
    return `PT-${String(n).padStart(4, "0")}`;
  }
  // No Redis configured (dev/demo): best-effort sequential from the roster.
  return `PT-${String((await highestExisting()) + 1).padStart(4, "0")}`;
}
const mem = new Map<string, Patient>();

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function parse(v: unknown): Patient | null {
  if (!v) return null;
  try { return typeof v === "string" ? JSON.parse(v) : (v as Patient); } catch { return null; }
}

export async function savePatient(p: Patient): Promise<void> {
  if (!p?.id) return;
  if (hasDb()) { await dbSavePatient(p); return; }
  const r = redis();
  if (r) await r.hset(KEY, { [p.id]: JSON.stringify(p) });
  else mem.set(p.id, p);
}

export async function listPatients(): Promise<Patient[]> {
  if (hasDb()) return dbListPatients();
  const r = redis();
  if (r) {
    const all = await r.hgetall<Record<string, unknown>>(KEY);
    if (!all) return [];
    return Object.values(all).map(parse).filter((x): x is Patient => !!x);
  }
  return Array.from(mem.values());
}

export async function getPatientById(id: string): Promise<Patient | null> {
  if (!id) return null;
  try { const all = await listPatients(); return all.find((p) => p.id === id) || null; } catch { return null; }
}

export function isPersistent(): boolean {
  return hasDb() || !!((process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) && (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN));
}
