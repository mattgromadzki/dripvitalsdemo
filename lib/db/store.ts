import "server-only";
import { db } from "./client";
import type { Patient } from "@/lib/types";

/**
 * Postgres persistence helpers. These back the app's existing storage interface
 * one-for-one:
 *   - generic collections (`store_domains`) keep the whole-domain blob semantics
 *     the client already uses, just durable in Postgres instead of KV.
 *   - patients get one row each (`patients`), with brand_id + email denormalized
 *     for querying while the full profile lives in `data` (jsonb). This is the
 *     first entity normalized out of the blob store.
 */

// ----- generic domain blobs -----
export async function dbGetDomain(domain: string): Promise<unknown | null> {
  const sql = db();
  if (!sql) return null;
  const rows = await sql<{ data: unknown }[]>`select data from store_domains where domain = ${domain} limit 1`;
  return rows.length ? rows[0].data : null;
}

export async function dbSetDomain(domain: string, data: unknown): Promise<void> {
  const sql = db();
  if (!sql) return;
  await sql`
    insert into store_domains (domain, data, updated_at)
    values (${domain}, ${sql.json(data as never)}, now())
    on conflict (domain) do update set data = excluded.data, updated_at = now()
  `;
}

// ----- patients (one row per patient) -----
export async function dbSavePatient(p: Patient): Promise<void> {
  const sql = db();
  if (!sql || !p?.id) return;
  await sql`
    insert into patients (id, brand_id, email, data, updated_at)
    values (${p.id}, ${p.brandId ?? "dripvitals"}, ${p.email ?? null}, ${sql.json(p as never)}, now())
    on conflict (id) do update set
      brand_id = excluded.brand_id,
      email = excluded.email,
      data = excluded.data,
      updated_at = now()
  `;
}

export async function dbListPatients(): Promise<Patient[]> {
  const sql = db();
  if (!sql) return [];
  const rows = await sql<{ data: Patient }[]>`select data from patients order by updated_at desc`;
  return rows.map((r) => r.data);
}

// ----- health check (used by readiness/connection screens) -----
export async function dbPing(): Promise<boolean> {
  const sql = db();
  if (!sql) return false;
  try { await sql`select 1`; return true; } catch { return false; }
}
