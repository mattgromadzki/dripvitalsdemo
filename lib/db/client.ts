import "server-only";
import postgres from "postgres";

/**
 * Single Postgres connection, created lazily from DATABASE_URL.
 *
 * Vendor-agnostic: works with any Postgres provider (Neon, Supabase, AWS RDS,
 * Vercel Postgres, self-hosted) via a standard connection string. On serverless
 * (Vercel) use the provider's POOLED / transaction-mode connection string; we
 * keep `prepare: false` so it's compatible with pgbouncer-style poolers and hold
 * one socket per warm instance.
 *
 * When DATABASE_URL is unset, `db()` returns null and callers fall back to the
 * previous Upstash/in-memory behavior — so the app keeps working before a
 * database is provisioned.
 */
type Sql = ReturnType<typeof postgres>;

let _sql: Sql | null = null;
let _init = false;

export function hasDb(): boolean {
  return !!process.env.DATABASE_URL;
}

export function db(): Sql | null {
  if (_init) return _sql;
  _init = true;
  const url = process.env.DATABASE_URL;
  if (!url) { _sql = null; return null; }
  _sql = postgres(url, {
    prepare: false, // safe with transaction-mode poolers (pgbouncer)
    max: 1, // one socket per serverless instance
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: process.env.DATABASE_SSL === "disable" ? false : "require",
  });
  return _sql;
}
