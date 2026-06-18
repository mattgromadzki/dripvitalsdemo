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
