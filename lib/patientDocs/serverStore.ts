import "server-only";
import { Redis } from "@upstash/redis";
import { hasDb } from "@/lib/db/client";
import { dbGetDomain, dbSetDomain } from "@/lib/db/store";
import { bumpVersion } from "@/lib/realtime/signal";
import type { PatientDocument } from "@/lib/types";

// Server-side append for the "patient-documents" domain — the same blob that
// staff hydrate through /api/store/patient-documents. Lets the PUBLIC intake
// form file documents (visit packet, government ID) without a staff session.
const DOMAIN = "patient-documents";
const KEY = `store:${DOMAIN}`;
const mem: { v: PatientDocument[] } = { v: [] };

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

async function readAll(): Promise<PatientDocument[]> {
  if (hasDb()) { const d = await dbGetDomain(DOMAIN); return Array.isArray(d) ? (d as PatientDocument[]) : []; }
  const r = redis();
  if (r) { const v = await r.get(KEY); const d = typeof v === "string" ? JSON.parse(v) : v; return Array.isArray(d) ? (d as PatientDocument[]) : []; }
  return mem.v;
}

async function writeAll(list: PatientDocument[]): Promise<void> {
  if (hasDb()) await dbSetDomain(DOMAIN, list);
  else { const r = redis(); if (r) await r.set(KEY, JSON.stringify(list)); else mem.v = list; }
  await bumpVersion(DOMAIN);
}

export async function appendPatientDocument(doc: PatientDocument): Promise<PatientDocument> {
  const all = await readAll();
  await writeAll([doc, ...all].slice(0, 5000));
  return doc;
}
