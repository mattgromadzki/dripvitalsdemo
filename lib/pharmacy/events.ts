import "server-only";
import { Redis } from "@upstash/redis";
import { hasDb } from "@/lib/db/client";
import { dbGetDomain, dbSetDomain } from "@/lib/db/store";
import { bumpVersion } from "@/lib/realtime/signal";

/**
 * Inbound pharmacy status events (e.g. 5Axis webhooks) are appended to the
 * "pharmacy-events" store domain using the same backend chain as the store
 * route (Postgres → Upstash → memory), then the realtime signal is bumped so
 * the tracker refetches. This is a push log that complements on-demand polling.
 */
export interface PharmacyEvent {
  id: string;
  connector: "greenstone";
  event: string;
  orderId?: string | number;
  internalOrderId?: string;
  patientId?: string;
  patientName?: string;
  status?: string;
  stage?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
  comment?: string;
  at: string;
}

const DOMAIN = "pharmacy-events";
const KEY = `store:${DOMAIN}`;
const mem: { v: PharmacyEvent[] } = { v: [] };

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

async function readAll(): Promise<PharmacyEvent[]> {
  try {
    if (hasDb()) { const d = await dbGetDomain(DOMAIN); return Array.isArray(d) ? (d as PharmacyEvent[]) : []; }
    const r = redis();
    if (r) { const v = await r.get(KEY); const d = typeof v === "string" ? JSON.parse(v) : v; return Array.isArray(d) ? (d as PharmacyEvent[]) : []; }
  } catch { /* ignore */ }
  return mem.v;
}

async function writeAll(list: PharmacyEvent[]): Promise<void> {
  if (hasDb()) await dbSetDomain(DOMAIN, list);
  else { const r = redis(); if (r) await r.set(KEY, JSON.stringify(list)); else mem.v = list; }
  await bumpVersion(DOMAIN);
}

export async function appendPharmacyEvent(evt: PharmacyEvent): Promise<void> {
  const all = await readAll();
  await writeAll([evt, ...all].slice(0, 3000));
}
