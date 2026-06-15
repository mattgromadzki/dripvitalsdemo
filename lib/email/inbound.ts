import "server-only";
import { Redis } from "@upstash/redis";
import { hasDb } from "@/lib/db/client";
import { dbGetDomain, dbSetDomain } from "@/lib/db/store";
import { bumpVersion } from "@/lib/realtime/signal";
import type { EmailMessage } from "./types";

/**
 * Writes received emails into the same "emails" store the EMR inbox reads, using
 * the same backend chain as the store route (Postgres → Upstash → memory). After
 * an append it bumps the realtime signal so any open inbox refetches and the new
 * message appears within ~2s.
 */
const DOMAIN = "emails";
const KEY = `store:${DOMAIN}`;
const mem: { v: EmailMessage[] } = { v: [] };

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

async function readAll(): Promise<EmailMessage[]> {
  try {
    if (hasDb()) { const d = await dbGetDomain(DOMAIN); return Array.isArray(d) ? (d as EmailMessage[]) : []; }
    const r = redis();
    if (r) { const v = await r.get(KEY); const d = typeof v === "string" ? JSON.parse(v) : v; return Array.isArray(d) ? (d as EmailMessage[]) : []; }
  } catch { /* ignore */ }
  return mem.v;
}

async function writeAll(list: EmailMessage[]): Promise<void> {
  if (hasDb()) await dbSetDomain(DOMAIN, list);
  else { const r = redis(); if (r) await r.set(KEY, JSON.stringify(list)); else mem.v = list; }
  await bumpVersion(DOMAIN);
}

export async function appendInbound(msg: EmailMessage): Promise<void> {
  const all = await readAll();
  if (all.some((m) => m.id === msg.id)) return; // de-dupe
  await writeAll([msg, ...all].slice(0, 2000)); // newest first; cap growth
}
