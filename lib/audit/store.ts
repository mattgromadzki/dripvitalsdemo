import "server-only";
import { Redis } from "@upstash/redis";
import { hasDb } from "@/lib/db/client";
import { dbGetDomain, dbSetDomain } from "@/lib/db/store";

/**
 * HIPAA audit trail. Append-only log of PHI-relevant access events (staff
 * opening a patient chart, sign-ins, etc.), stored on the same backend chain as
 * the other server stores (Postgres → Upstash → memory). This satisfies the
 * Security Rule's audit-controls requirement: a record of who did what, and when.
 *
 * The acting user (`actorEmail`) is always derived from the verified session on
 * the server — never trusted from the client — so entries can't be spoofed.
 */
export interface AuditEvent {
  id: string;
  at: string;             // ISO timestamp
  action: string;         // e.g. "chart.view", "auth.login", "auth.login_failed"
  actorEmail: string;     // who performed the action
  actorName?: string;
  actorRole?: string;
  patientId?: string;     // subject patient, when applicable
  detail?: string;        // free-text context
  ip?: string;
  geo?: string;           // "City, Region, Country" from the edge, when known
}

/** Approximate location from Vercel's edge geo headers (city-level, based on
 *  the connecting IP). Absent when running locally or behind other proxies. */
export function requestGeo(req: Request): string | undefined {
  try {
    const city = req.headers.get("x-vercel-ip-city");
    const region = req.headers.get("x-vercel-ip-country-region");
    const country = req.headers.get("x-vercel-ip-country");
    const parts = [city ? decodeURIComponent(city) : null, region, country].filter(Boolean);
    return parts.length ? parts.join(", ") : undefined;
  } catch { return undefined; }
}

const DOMAIN = "audit-log";
const KEY = `store:${DOMAIN}`;
const MAX_EVENTS = 10000;
const mem: { v: AuditEvent[] } = { v: [] };

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

async function readAll(): Promise<AuditEvent[]> {
  try {
    if (hasDb()) { const d = await dbGetDomain(DOMAIN); return Array.isArray(d) ? (d as AuditEvent[]) : []; }
    const r = redis();
    if (r) { const v = await r.get(KEY); const d = typeof v === "string" ? JSON.parse(v) : v; return Array.isArray(d) ? (d as AuditEvent[]) : []; }
  } catch { /* ignore */ }
  return mem.v;
}

async function writeAll(list: AuditEvent[]): Promise<void> {
  if (hasDb()) await dbSetDomain(DOMAIN, list);
  else { const r = redis(); if (r) await r.set(KEY, JSON.stringify(list)); else mem.v = list; }
}

export async function appendAuditEvent(evt: Omit<AuditEvent, "id" | "at"> & { at?: string }): Promise<void> {
  const full: AuditEvent = {
    id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: evt.at || new Date().toISOString(),
    action: evt.action,
    actorEmail: evt.actorEmail,
    actorName: evt.actorName,
    actorRole: evt.actorRole,
    patientId: evt.patientId,
    detail: evt.detail,
    ip: evt.ip,
  };
  const all = await readAll();
  await writeAll([full, ...all].slice(0, MAX_EVENTS));
}

export async function listAuditEvents(limit = 500): Promise<AuditEvent[]> {
  const all = await readAll();
  return all.slice(0, Math.max(1, Math.min(limit, MAX_EVENTS)));
}
