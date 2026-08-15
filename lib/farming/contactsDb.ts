import "server-only";
import { randomUUID } from "crypto";
import { db, hasDb } from "@/lib/db/client";
import { readDomain, writeDomain } from "./serverStore";
import type { FarmContact, FarmStatus, ContactInput } from "@/lib/types/farming";

// Build a full contact from create/import input (server assigns id + defaults).
export function buildContact(input: ContactInput): FarmContact {
  return {
    status: "new", optedOut: false,
    ...input,
    firstName: input.firstName || "", lastName: input.lastName || "",
    email: input.email || "", phone: input.phone || "",
    groupIds: input.groupIds || [], // guard: never undefined (import rows omit it)
    id: "FC-" + randomUUID().slice(0, 18),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Scalable per-contact data layer for the Farming module.
 *
 * When DATABASE_URL is set (hasDb()) contacts live one-row-each in the
 * `farming_contacts` Postgres table — server-paginated, indexed, built for
 * millions. Without a database it falls back to the existing whole-array blob
 * (store domain "farming-contacts") so local/dev and small installs keep working
 * unchanged. The exported API is identical either way; only the backend differs.
 */

const DOMAIN = "farming-contacts";
const digits10 = (p?: string) => (p || "").replace(/\D/g, "").slice(-10);

export interface ContactFilter { search?: string; status?: string; group?: string; includeSuppressed?: boolean; }
export interface ContactPage { contacts: FarmContact[]; nextCursor: string | null; }
export interface ContactCounts { total: number; suppressed: number; reachableEmail: number; reachablePhone: number; byStatus: Record<string, number>; }
// A bulk target: an explicit id list, or a filter meaning "everything matching".
export type Selection = { ids: string[] } | { filter: ContactFilter };

export function contactsUseDb(): boolean { return hasDb(); }

// ── cursor helpers (Postgres keyset) ──────────────────────────────────────
function encodeCursor(createdAt: Date | string, id: string): string {
  const iso = typeof createdAt === "string" ? createdAt : createdAt.toISOString();
  return Buffer.from(`${iso}|${id}`).toString("base64url");
}
function decodeCursor(c: string): { iso: string; id: string } | null {
  try { const [iso, id] = Buffer.from(c, "base64url").toString().split("|"); return iso && id ? { iso, id } : null; } catch { return null; }
}

// ── Postgres WHERE fragment from a filter ─────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function whereFor(sql: any, f: ContactFilter) {
  const conds: any[] = [];
  if (!f.includeSuppressed) conds.push(sql`opted_out = false`);
  if (f.status) conds.push(sql`status = ${f.status}`);
  if (f.group) conds.push(sql`${f.group} = any(group_ids)`);
  if (f.search && f.search.trim()) {
    const q = `%${f.search.trim().toLowerCase()}%`;
    conds.push(sql`lower(coalesce(email,'') || ' ' || coalesce(data->>'firstName','') || ' ' || coalesce(data->>'lastName','') || ' ' || coalesce(data->>'company','')) like ${q}`);
  }
  if (!conds.length) return sql`true`;
  let frag = conds[0];
  for (let i = 1; i < conds.length; i++) frag = sql`${frag} and ${conds[i]}`;
  return frag;
}

// Row columns derived from a full FarmContact (denormalized for indexing).
function cols(c: FarmContact) {
  return { id: c.id, email: c.email || null, phone: digits10(c.phone) || null, status: c.status, opted_out: !!c.optedOut, group_ids: c.groupIds || [], last_campaign_id: c.lastCampaignId || null, data: c };
}

// ── blob fallback helpers ─────────────────────────────────────────────────
async function blobAll(): Promise<FarmContact[]> { return (await readDomain<FarmContact[]>(DOMAIN)) || []; }
async function blobSave(list: FarmContact[]): Promise<void> { await writeDomain(DOMAIN, list); }
function blobMatch(c: FarmContact, f: ContactFilter): boolean {
  if (!f.includeSuppressed && c.optedOut) return false;
  if (f.status && c.status !== f.status) return false;
  if (f.group && !(c.groupIds || []).includes(f.group)) return false;
  if (f.search && f.search.trim()) {
    const q = f.search.trim().toLowerCase();
    if (!`${c.firstName} ${c.lastName} ${c.email} ${c.phone} ${c.company || ""}`.toLowerCase().includes(q)) return false;
  }
  return true;
}
const bySort = (a: FarmContact, b: FarmContact) => (b.createdAt || "").localeCompare(a.createdAt || "") || (b.id).localeCompare(a.id);

// ── list ──────────────────────────────────────────────────────────────────
export async function listContacts(f: ContactFilter, cursor: string | null, limit = 50): Promise<ContactPage> {
  if (contactsUseDb()) {
    const sql = db()!;
    const where = whereFor(sql, f);
    const cur = cursor ? decodeCursor(cursor) : null;
    const keyset = cur ? sql`and (created_at, id) < (${cur.iso}, ${cur.id})` : sql``;
    const rows = await sql<{ data: FarmContact; created_at: Date; id: string }[]>`select data, created_at, id from farming_contacts where ${where} ${keyset} order by created_at desc, id desc limit ${limit + 1}`;
    const more = rows.length > limit;
    const page = rows.slice(0, limit);
    const next = more ? encodeCursor(page[page.length - 1].created_at, page[page.length - 1].id) : null;
    return { contacts: page.map((r) => r.data), nextCursor: next };
  }
  const all = (await blobAll()).filter((c) => blobMatch(c, f)).sort(bySort);
  const off = cursor ? parseInt(cursor, 10) || 0 : 0;
  const page = all.slice(off, off + limit);
  const next = off + limit < all.length ? String(off + limit) : null;
  return { contacts: page, nextCursor: next };
}

export async function countContacts(f: ContactFilter): Promise<number> {
  if (contactsUseDb()) {
    const sql = db()!;
    const where = whereFor(sql, f);
    const [r] = await sql`select count(*)::int n from farming_contacts where ${where}`;
    return r.n;
  }
  return (await blobAll()).filter((c) => blobMatch(c, f)).length;
}

export async function aggregateCounts(): Promise<ContactCounts> {
  if (contactsUseDb()) {
    const sql = db()!;
    const [r] = await sql`select
      count(*)::int total,
      count(*) filter (where opted_out)::int suppressed,
      count(*) filter (where email is not null and email <> '' and not opted_out)::int reachable_email,
      count(*) filter (where phone is not null and phone <> '' and not opted_out)::int reachable_phone
      from farming_contacts`;
    const st = await sql`select status, count(*)::int n from farming_contacts group by status`;
    const byStatus: Record<string, number> = {};
    for (const row of st) byStatus[row.status] = row.n;
    return { total: r.total, suppressed: r.suppressed, reachableEmail: r.reachable_email, reachablePhone: r.reachable_phone, byStatus };
  }
  const all = await blobAll();
  const byStatus: Record<string, number> = {};
  for (const c of all) byStatus[c.status] = (byStatus[c.status] || 0) + 1;
  return {
    total: all.length,
    suppressed: all.filter((c) => c.optedOut).length,
    reachableEmail: all.filter((c) => c.email && !c.optedOut).length,
    reachablePhone: all.filter((c) => c.phone && !c.optedOut).length,
    byStatus,
  };
}

export async function groupCounts(): Promise<Record<string, number>> {
  if (contactsUseDb()) {
    const sql = db()!;
    const rows = await sql`select g as group_id, count(*)::int n from farming_contacts, unnest(group_ids) g group by g`;
    const out: Record<string, number> = {};
    for (const r of rows) out[r.group_id] = r.n;
    return out;
  }
  const all = await blobAll();
  const out: Record<string, number> = {};
  for (const c of all) for (const g of (c.groupIds || [])) out[g] = (out[g] || 0) + 1;
  return out;
}

// ── single-row reads ──────────────────────────────────────────────────────
export async function getContact(id: string): Promise<FarmContact | null> {
  if (contactsUseDb()) { const sql = db()!; const [r] = await sql<{ data: FarmContact }[]>`select data from farming_contacts where id = ${id} limit 1`; return r ? r.data : null; }
  return (await blobAll()).find((c) => c.id === id) || null;
}
export async function findByEmail(email: string): Promise<FarmContact | null> {
  const em = (email || "").trim().toLowerCase(); if (!em) return null;
  if (contactsUseDb()) { const sql = db()!; const [r] = await sql<{ data: FarmContact }[]>`select data from farming_contacts where lower(email) = ${em} limit 1`; return r ? r.data : null; }
  return (await blobAll()).find((c) => c.email.toLowerCase() === em) || null;
}
export async function findByPhone(phone: string): Promise<FarmContact[]> {
  const p = digits10(phone); if (!p) return [];
  if (contactsUseDb()) { const sql = db()!; const rows = await sql<{ data: FarmContact }[]>`select data from farming_contacts where phone = ${p}`; return rows.map((r) => r.data); }
  return (await blobAll()).filter((c) => digits10(c.phone) === p);
}

// ── single-row writes ─────────────────────────────────────────────────────
export async function upsertContact(c: FarmContact): Promise<void> {
  if (contactsUseDb()) {
    const sql = db()!; const v = cols(c);
    await sql`insert into farming_contacts (id,email,phone,status,opted_out,group_ids,last_campaign_id,data,updated_at)
      values (${v.id}, ${v.email}, ${v.phone}, ${v.status}, ${v.opted_out}, ${v.group_ids}, ${v.last_campaign_id}, ${sql.json(v.data as never)}, now())
      on conflict (id) do update set email=excluded.email, phone=excluded.phone, status=excluded.status, opted_out=excluded.opted_out, group_ids=excluded.group_ids, last_campaign_id=excluded.last_campaign_id, data=excluded.data, updated_at=now()`;
    return;
  }
  const all = await blobAll(); const i = all.findIndex((x) => x.id === c.id);
  if (i >= 0) all[i] = c; else all.unshift(c);
  await blobSave(all);
}

// Merge a partial patch into a contact and persist (single row).
export async function updateContactFields(id: string, patch: Partial<FarmContact>): Promise<FarmContact | null> {
  const cur = await getContact(id); if (!cur) return null;
  const next = { ...cur, ...patch };
  await upsertContact(next);
  return next;
}

// ── bulk selection resolution → WHERE (ids or filter) ─────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function selWhere(sql: any, sel: Selection) {
  if ("ids" in sel) return sql`id = any(${sel.ids})`;
  return whereFor(sql, sel.filter);
}
async function blobSelect(all: FarmContact[], sel: Selection): Promise<(c: FarmContact) => boolean> {
  if ("ids" in sel) { const s = new Set(sel.ids); return (c) => s.has(c.id); }
  return (c) => blobMatch(c, sel.filter);
}

export async function bulkSetStatus(sel: Selection, status: FarmStatus): Promise<number> {
  if (contactsUseDb()) {
    const sql = db()!;
    const r = await sql`update farming_contacts set status=${status}, data=jsonb_set(data,'{status}', to_jsonb(${status}::text)), updated_at=now() where ${selWhere(sql, sel)}`;
    return r.count ?? 0;
  }
  const all = await blobAll(); const hit = await blobSelect(all, sel); let n = 0;
  for (const c of all) if (hit(c)) { c.status = status; n++; }
  await blobSave(all); return n;
}
export async function bulkAddGroup(sel: Selection, groupId: string): Promise<number> {
  if (contactsUseDb()) {
    const sql = db()!;
    const r = await sql`update farming_contacts set
      group_ids = array_append(array_remove(group_ids, ${groupId}), ${groupId}),
      data = jsonb_set(data,'{groupIds}', to_jsonb(array_append(array_remove(group_ids, ${groupId}), ${groupId}))),
      updated_at=now() where ${selWhere(sql, sel)}`;
    return r.count ?? 0;
  }
  const all = await blobAll(); const hit = await blobSelect(all, sel); let n = 0;
  for (const c of all) if (hit(c) && !(c.groupIds || []).includes(groupId)) { c.groupIds = [...(c.groupIds || []), groupId]; n++; }
  await blobSave(all); return n;
}
export async function bulkMoveGroup(sel: Selection, groupId: string): Promise<number> {
  if (contactsUseDb()) {
    const sql = db()!;
    const r = await sql`update farming_contacts set group_ids = array[${groupId}], data = jsonb_set(data,'{groupIds}', to_jsonb(array[${groupId}]::text[])), updated_at=now() where ${selWhere(sql, sel)}`;
    return r.count ?? 0;
  }
  const all = await blobAll(); const hit = await blobSelect(all, sel); let n = 0;
  for (const c of all) if (hit(c)) { c.groupIds = [groupId]; n++; }
  await blobSave(all); return n;
}
export async function bulkDelete(sel: Selection): Promise<number> {
  if (contactsUseDb()) { const sql = db()!; const r = await sql`delete from farming_contacts where ${selWhere(sql, sel)}`; return r.count ?? 0; }
  const all = await blobAll(); const hit = await blobSelect(all, sel);
  const kept = all.filter((c) => !hit(c)); await blobSave(kept); return all.length - kept.length;
}
export async function stripGroup(groupId: string): Promise<void> {
  if (contactsUseDb()) {
    const sql = db()!;
    await sql`update farming_contacts set group_ids = array_remove(group_ids, ${groupId}), data = jsonb_set(data,'{groupIds}', to_jsonb(array_remove(group_ids, ${groupId}))), updated_at=now() where ${groupId} = any(group_ids)`;
    return;
  }
  const all = await blobAll(); let dirty = false;
  for (const c of all) if ((c.groupIds || []).includes(groupId)) { c.groupIds = (c.groupIds || []).filter((g) => g !== groupId); dirty = true; }
  if (dirty) await blobSave(all);
}

// ── opt-out / suppression (used by unsubscribe + STOP) ────────────────────
export async function setOptedOutById(id: string, optedOut: boolean, channel?: "email" | "sms" | "both"): Promise<boolean> {
  const c = await getContact(id); if (!c) return false;
  await upsertContact({ ...c, optedOut, status: optedOut ? "unsubscribed" : (c.status === "unsubscribed" ? "new" : c.status), optOutAt: optedOut ? new Date().toISOString() : undefined, optOutChannel: optedOut ? (channel || "both") : undefined });
  return true;
}
export async function setOptedOutByPhone(phone: string, optedOut: boolean): Promise<number> {
  const matches = await findByPhone(phone); let n = 0;
  for (const c of matches) { await upsertContact({ ...c, optedOut, status: optedOut ? "unsubscribed" : (c.status === "unsubscribed" ? "new" : c.status), optOutAt: optedOut ? new Date().toISOString() : undefined, optOutChannel: optedOut ? "sms" : undefined }); n++; }
  return n;
}

// Mark a contact "replied" (by phone or email) — returns {contactId,lastCampaignId} for attribution.
export async function markReplied(match: { phone?: string; email?: string }): Promise<{ contactId: string; lastCampaignId?: string } | null> {
  let c: FarmContact | null = null;
  if (match.email) c = await findByEmail(match.email);
  if (!c && match.phone) { const m = await findByPhone(match.phone); c = m[0] || null; }
  if (!c) return null;
  if (c.status !== "unsubscribed") await updateContactFields(c.id, { status: "replied" });
  return { contactId: c.id, lastCampaignId: c.lastCampaignId };
}

// ── import: bulk insert a chunk with email dedupe ─────────────────────────
export async function bulkInsert(rows: FarmContact[]): Promise<{ inserted: number; duplicates: number }> {
  if (!rows.length) return { inserted: 0, duplicates: 0 };
  // Dedupe within this batch by email first (Postgres ON CONFLICT doesn't
  // resolve two conflicting rows inside one statement).
  const seen = new Set<string>(); const batch: FarmContact[] = []; let dupes = 0;
  for (const c of rows) { const k = (c.email || "").trim().toLowerCase(); if (k) { if (seen.has(k)) { dupes++; continue; } seen.add(k); } batch.push(c); }

  if (contactsUseDb()) {
    const sql = db()!;
    // postgres.js serializes plain objects → jsonb and JS arrays → text[] through
    // the multi-row helper. Sub-batch to stay under Postgres's 65,534-parameter
    // cap (8 cols × 4,000 rows = 32k params).
    const SUB = 4000;
    let inserted = 0;
    for (let i = 0; i < batch.length; i += SUB) {
      const values: Record<string, unknown>[] = batch.slice(i, i + SUB).map((c) => cols(c) as unknown as Record<string, unknown>);
      const ins = await sql`insert into farming_contacts ${sql(values, "id", "email", "phone", "status", "opted_out", "group_ids", "last_campaign_id", "data")}
        on conflict (lower(email)) where email is not null and email <> '' do nothing returning id`;
      inserted += ins.length;
    }
    return { inserted, duplicates: dupes + (batch.length - inserted) };
  }
  const all = await blobAll();
  const existing = new Set(all.map((c) => (c.email || "").trim().toLowerCase()).filter(Boolean));
  let inserted = 0;
  for (const c of batch) { const k = (c.email || "").trim().toLowerCase(); if (k && existing.has(k)) { dupes++; continue; } if (k) existing.add(k); all.unshift(c); inserted++; }
  await blobSave(all);
  return { inserted, duplicates: dupes };
}

// ── audience paging for the dispatcher ────────────────────────────────────
import type { FarmAudience } from "@/lib/types/farming";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function audienceWhere(sql: any, a: FarmAudience, channel: "email" | "sms") {
  const conds: any[] = [sql`opted_out = false`];
  conds.push(channel === "email" ? sql`email is not null and email <> ''` : sql`phone is not null and phone <> ''`);
  if (a.kind === "group") conds.push(sql`group_ids && ${a.groupIds || []}`);
  else if (a.kind === "status") conds.push(sql`status = any(${a.statuses || []})`);
  // "all" adds nothing; "selection" handled separately (id paging).
  let frag = conds[0];
  for (let i = 1; i < conds.length; i++) frag = sql`${frag} and ${conds[i]}`;
  return frag;
}
function reachableInMemory(c: FarmContact, a: FarmAudience, channel: "email" | "sms"): boolean {
  if (c.optedOut) return false;
  if (channel === "email" ? !c.email : !c.phone) return false;
  if (a.kind === "group") return (c.groupIds || []).some((g) => (a.groupIds || []).includes(g));
  if (a.kind === "status") return (a.statuses || []).includes(c.status);
  return true;
}

// A page of reachable recipients for a campaign audience (+ opaque cursor).
export async function pageAudience(a: FarmAudience, channel: "email" | "sms", cursor: string | null, limit: number): Promise<ContactPage> {
  if (a.kind === "selection") {
    const ids = a.contactIds || [];
    const off = cursor ? parseInt(cursor, 10) || 0 : 0;
    const slice = ids.slice(off, off + limit);
    const out: FarmContact[] = [];
    for (const id of slice) { const c = await getContact(id); if (c && reachableInMemory(c, a, channel)) out.push(c); }
    return { contacts: out, nextCursor: off + limit < ids.length ? String(off + limit) : null };
  }
  if (contactsUseDb()) {
    const sql = db()!;
    const where = audienceWhere(sql, a, channel);
    const cur = cursor ? decodeCursor(cursor) : null;
    const keyset = cur ? sql`and (created_at, id) < (${cur.iso}, ${cur.id})` : sql``;
    const rows = await sql<{ data: FarmContact; created_at: Date; id: string }[]>`select data, created_at, id from farming_contacts where ${where} ${keyset} order by created_at desc, id desc limit ${limit + 1}`;
    const more = rows.length > limit; const page = rows.slice(0, limit);
    const next = more ? encodeCursor(page[page.length - 1].created_at, page[page.length - 1].id) : null;
    return { contacts: page.map((r) => r.data), nextCursor: next };
  }
  // blob fallback: keyset by offset.
  const all = (await blobAll()).filter((c) => reachableInMemory(c, a, channel)).sort(bySort);
  const off = cursor ? parseInt(cursor, 10) || 0 : 0;
  const page = all.slice(off, off + limit);
  return { contacts: page, nextCursor: off + limit < all.length ? String(off + limit) : null };
}

export async function audienceCount(a: FarmAudience, channel: "email" | "sms"): Promise<number> {
  if (a.kind === "selection") {
    let n = 0; for (const id of a.contactIds || []) { const c = await getContact(id); if (c && reachableInMemory(c, a, channel)) n++; } return n;
  }
  if (contactsUseDb()) { const sql = db()!; const [r] = await sql`select count(*)::int n from farming_contacts where ${audienceWhere(sql, a, channel)}`; return r.n; }
  return (await blobAll()).filter((c) => reachableInMemory(c, a, channel)).length;
}
