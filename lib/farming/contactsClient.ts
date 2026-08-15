"use client";
import type { FarmContact, ContactInput, FarmAudience, FarmChannel } from "@/lib/types/farming";

// Client fetch wrappers for the server-paginated contacts API. The browser never
// holds the full contact set — only the current page.

export interface ListParams { search?: string; status?: string; group?: string; state?: string; county?: string; city?: string; includeSuppressed?: boolean; cursor?: string | null; limit?: number; }
export interface ContactPage { contacts: FarmContact[]; nextCursor: string | null; }
export interface Counts { total: number; suppressed: number; reachableEmail: number; reachablePhone: number; byStatus: Record<string, number>; groups: Record<string, number>; filtered?: number; }
export interface Filter { search?: string; status?: string; group?: string; state?: string; county?: string; city?: string; includeSuppressed?: boolean; }
export interface SendCounts { sent: number; delivered: number; opened: number; clicked: number; replied: number; }

function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") u.set(k, String(v));
  return u.toString();
}

export async function listContacts(p: ListParams): Promise<ContactPage> {
  const r = await fetch(`/api/farming/contacts?${qs({ search: p.search, status: p.status, group: p.group, state: p.state, county: p.county, city: p.city, includeSuppressed: p.includeSuppressed, cursor: p.cursor, limit: p.limit })}`, { cache: "no-store" });
  const d = await r.json();
  return { contacts: d.contacts || [], nextCursor: d.nextCursor ?? null };
}
export async function getFacet(field: "state" | "county" | "city", parent: { state?: string; county?: string } = {}): Promise<string[]> {
  const r = await fetch(`/api/farming/contacts/facets?${qs({ field, state: parent.state, county: parent.county })}`, { cache: "no-store" });
  const d = await r.json(); return d.ok ? (d.values || []) : [];
}
export async function getCounts(f: Filter): Promise<Counts> {
  const r = await fetch(`/api/farming/contacts/count?${qs({ ...f })}`, { cache: "no-store" });
  const d = await r.json();
  return { total: d.total || 0, suppressed: d.suppressed || 0, reachableEmail: d.reachableEmail || 0, reachablePhone: d.reachablePhone || 0, byStatus: d.byStatus || {}, groups: d.groups || {}, filtered: d.filtered };
}
export async function createContact(contact: ContactInput): Promise<FarmContact | null> {
  const r = await fetch("/api/farming/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contact }) });
  const d = await r.json(); return d.ok ? d.contact : null;
}
export async function updateContact(id: string, patch: Partial<FarmContact>): Promise<boolean> {
  const r = await fetch(`/api/farming/contacts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patch }) });
  return (await r.json()).ok;
}
export async function deleteContact(id: string): Promise<boolean> {
  const r = await fetch(`/api/farming/contacts/${id}`, { method: "DELETE" });
  return (await r.json()).ok;
}
export async function bulkAction(action: "setStatus" | "addGroup" | "moveGroup" | "delete", target: { ids?: string[]; filter?: Filter }, value?: string): Promise<number> {
  const r = await fetch("/api/farming/contacts/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...target, value }) });
  const d = await r.json(); return d.ok ? (d.affected || 0) : 0;
}
export async function stripGroupFromContacts(groupId: string): Promise<void> {
  await fetch("/api/farming/contacts/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "stripGroup", value: groupId }) });
}
export async function importChunk(rows: ContactInput[], groupId?: string): Promise<{ inserted: number; duplicates: number; invalid: number }> {
  const r = await fetch("/api/farming/contacts/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows, groupId }) });
  const d = await r.json(); return { inserted: d.inserted || 0, duplicates: d.duplicates || 0, invalid: d.invalid || 0 };
}
export async function audienceCount(audience: FarmAudience, channel: FarmChannel): Promise<number> {
  const r = await fetch("/api/farming/contacts/audience-count", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audience, channel }) });
  const d = await r.json(); return d.ok ? (d.count || 0) : 0;
}
export async function campaignAnalytics(): Promise<Record<string, SendCounts>> {
  const r = await fetch("/api/farming/campaigns/analytics", { cache: "no-store" });
  const d = await r.json(); return d.counts || {};
}
export interface SendRow { contactId: string; name: string; status: string; deliveredAt?: string; openedAt?: string; clickedAt?: string; repliedAt?: string }
export async function campaignSends(id: string, offset = 0, limit = 100): Promise<{ counts: SendCounts; sends: SendRow[] }> {
  const r = await fetch(`/api/farming/campaigns/${id}/sends?${qs({ offset, limit })}`, { cache: "no-store" });
  const d = await r.json();
  return { counts: d.counts || { sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0 }, sends: d.sends || [] };
}
export function exportUrl(f: Filter): string {
  return `/api/farming/contacts/export?${qs({ ...f })}`;
}
