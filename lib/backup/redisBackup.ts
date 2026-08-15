import "server-only";
import { Redis } from "@upstash/redis";
import { db } from "@/lib/db/client";

/**
 * Point-in-time backups of the Upstash Redis store — where ALL EMR/app data
 * lives (patients, visits, documents, payments, orders, etc.). A daily cron
 * snapshots every Redis key into the Neon `redis_backups` table, giving a
 * second, durable copy that can be restored key-by-key. Retention is pruned to
 * BACKUP_KEEP most-recent snapshots.
 */
const BACKUP_KEEP = 14; // keep the last 14 daily snapshots

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

interface Entry { t: "string" | "hash" | "list" | "set"; v: unknown }
export type Snapshot = Record<string, Entry>;

// Read every key + its full value (typed) from Redis.
export async function snapshotRedis(): Promise<Snapshot> {
  const r = redis();
  if (!r) throw new Error("Redis not configured");
  const keys: string[] = [];
  let cursor = "0";
  do { const [c, batch] = await r.scan(cursor, { count: 400 }); cursor = c; keys.push(...batch); } while (cursor !== "0");

  const out: Snapshot = {};
  for (const k of keys) {
    try {
      const t = await r.type(k);
      if (t === "string") out[k] = { t: "string", v: await r.get(k) };
      else if (t === "hash") out[k] = { t: "hash", v: await r.hgetall(k) };
      else if (t === "list") out[k] = { t: "list", v: await r.lrange(k, 0, -1) };
      else if (t === "set") out[k] = { t: "set", v: await r.smembers(k) };
      // skip zset/stream/other — not used by this app
    } catch { /* skip unreadable key */ }
  }
  return out;
}

// Store a snapshot in Neon + prune old ones. Returns {id, keyCount}.
export async function runBackup(): Promise<{ id: number; keyCount: number }> {
  const sql = db();
  if (!sql) throw new Error("Backup target (Neon) not configured");
  const snap = await snapshotRedis();
  const keyCount = Object.keys(snap).length;
  const [row] = await sql<{ id: number }[]>`insert into redis_backups (key_count, data) values (${keyCount}, ${sql.json(snap as never)}) returning id`;
  // Retention: keep only the most recent BACKUP_KEEP snapshots.
  await sql`delete from redis_backups where id not in (select id from redis_backups order by created_at desc limit ${BACKUP_KEEP})`;
  return { id: row.id, keyCount };
}

export interface BackupMeta { id: number; created_at: string; key_count: number }
export async function listBackups(): Promise<BackupMeta[]> {
  const sql = db(); if (!sql) return [];
  return sql<BackupMeta[]>`select id, created_at, key_count from redis_backups order by created_at desc`;
}

// Restore a snapshot back into Redis. DESTRUCTIVE for the keys it contains
// (each is deleted and rewritten). Existing keys not in the snapshot are left
// untouched unless `wipeFirst` is set. Intended for deliberate recovery only.
export async function restoreBackup(id: number, opts: { wipeFirst?: boolean } = {}): Promise<{ restored: number }> {
  const sql = db(); if (!sql) throw new Error("Neon not configured");
  const r = redis(); if (!r) throw new Error("Redis not configured");
  const [row] = await sql<{ data: Snapshot }[]>`select data from redis_backups where id = ${id}`;
  if (!row) throw new Error("Backup not found");
  const snap = row.data;

  if (opts.wipeFirst) { for (const k of Object.keys(snap)) await r.del(k); }
  let restored = 0;
  for (const [k, e] of Object.entries(snap)) {
    try {
      await r.del(k);
      if (e.t === "string") { if (e.v != null) await r.set(k, typeof e.v === "string" ? e.v : JSON.stringify(e.v)); }
      else if (e.t === "hash") { const h = e.v as Record<string, unknown>; const m: Record<string, string> = {}; for (const [f, val] of Object.entries(h || {})) m[f] = typeof val === "string" ? val : JSON.stringify(val); if (Object.keys(m).length) await r.hset(k, m); }
      else if (e.t === "list") { const arr = ((e.v as unknown[]) || []) as [string, ...string[]]; if (arr.length) await r.rpush(k, ...arr); }
      else if (e.t === "set") { const arr = ((e.v as unknown[]) || []) as [string, ...string[]]; if (arr.length) await r.sadd(k, ...arr); }
      restored++;
    } catch { /* skip */ }
  }
  return { restored };
}
