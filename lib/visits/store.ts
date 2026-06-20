import "server-only";
import { Redis } from "@upstash/redis";
import { hasDb } from "@/lib/db/client";
import { dbGetDomain, dbSetDomain } from "@/lib/db/store";
import { bumpVersion } from "@/lib/realtime/signal";
import { estParts } from "@/lib/time/est";

/**
 * A Visit is one intake episode. It is created the moment a patient opens an
 * intake form (status "started", EST timestamp). As they progress it records the
 * treatment they selected and their shipping details. On payment it flips to
 * "paid" and the displayed timestamp is overwritten with the payment time. A
 * visit that never gets paid stays as "started"/"unpaid" so admins can see and
 * delete abandoned intakes. One intake = one visit (two treatments = two visits).
 */
export interface Visit {
  id: string;
  status: "started" | "unpaid" | "paid";
  startedAt: number;          // epoch ms, captured at form open
  startedDisplay: string;     // EST display of startedAt
  paidAt?: number;            // epoch ms, set on payment
  paidDisplay?: string;       // EST display of paidAt (overwrites startedDisplay in UI)
  patientId?: string;
  patientName?: string;
  email?: string;
  phone?: string;
  treatmentId?: string;
  treatmentName?: string;
  price?: number;
  intakeFormId?: string;
  intakeFormName?: string;
  shippingAddress?: { street?: string; line2?: string; city?: string; state?: string; zip?: string };
  updatedAt: number;
}

const DOMAIN = "visits";
const KEY = `store:${DOMAIN}`;
const mem: { v: Visit[] } = { v: [] };

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

async function readAll(): Promise<Visit[]> {
  try {
    if (hasDb()) { const d = await dbGetDomain(DOMAIN); return Array.isArray(d) ? (d as Visit[]) : []; }
    const r = redis();
    if (r) { const v = await r.get(KEY); const d = typeof v === "string" ? JSON.parse(v) : v; return Array.isArray(d) ? (d as Visit[]) : []; }
  } catch { /* ignore */ }
  return mem.v;
}

async function writeAll(list: Visit[]): Promise<void> {
  if (hasDb()) await dbSetDomain(DOMAIN, list);
  else { const r = redis(); if (r) await r.set(KEY, JSON.stringify(list)); else mem.v = list; }
  await bumpVersion(DOMAIN);
}

export async function listVisits(): Promise<Visit[]> {
  const all = await readAll();
  return all.slice().sort((a, b) => (b.paidAt || b.startedAt) - (a.paidAt || a.startedAt));
}

/** Create the visit at the first real step (idempotent on id — re-renders won't
 * duplicate; a re-call merges any newly-captured contact/form info). */
export async function startVisit(input: { id: string } & Partial<Visit>): Promise<Visit> {
  const all = await readAll();
  const existing = all.find((v) => v.id === input.id);
  const known: Partial<Visit> = {
    patientId: input.patientId, patientName: input.patientName, email: input.email, phone: input.phone,
    treatmentId: input.treatmentId, treatmentName: input.treatmentName, price: input.price,
    intakeFormId: input.intakeFormId, intakeFormName: input.intakeFormName, shippingAddress: input.shippingAddress,
  };
  if (existing) {
    return (await updateVisit(input.id, known)) || existing;
  }
  const { ms, display } = estParts();
  const visit: Visit = { id: input.id, status: "started", startedAt: ms, startedDisplay: display, updatedAt: ms, ...known };
  await writeAll([visit, ...all].slice(0, 5000));
  return visit;
}

/** Patch a visit as the patient progresses (contact, treatment, shipping). */
export async function updateVisit(id: string, patch: Partial<Visit>): Promise<Visit | null> {
  const all = await readAll();
  const i = all.findIndex((v) => v.id === id);
  if (i < 0) return null;
  const merged: Visit = { ...all[i], ...patch, id, updatedAt: Date.now() };
  all[i] = merged;
  await writeAll(all);
  return merged;
}

/** Mark paid: overwrite the displayed timestamp with the payment time. Upserts
 * if the visit was never recorded at start (e.g. completion without a start hook). */
export async function markVisitPaid(id: string, patch: Partial<Visit> = {}): Promise<Visit | null> {
  const all = await readAll();
  const { ms, display } = estParts();
  const i = all.findIndex((v) => v.id === id);
  if (i < 0) {
    const visit: Visit = { startedAt: ms, startedDisplay: display, ...patch, id, status: "paid", paidAt: ms, paidDisplay: display, updatedAt: ms } as Visit;
    await writeAll([visit, ...all].slice(0, 5000));
    return visit;
  }
  all[i] = { ...all[i], ...patch, id, status: "paid", paidAt: ms, paidDisplay: display, updatedAt: ms };
  await writeAll(all);
  return all[i];
}

/** Admin delete a visit from the EMR. */
export async function removeVisit(id: string): Promise<boolean> {
  const all = await readAll();
  const next = all.filter((v) => v.id !== id);
  if (next.length === all.length) return false;
  await writeAll(next);
  return true;
}
