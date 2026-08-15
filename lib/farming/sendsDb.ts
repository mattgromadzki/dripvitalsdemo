import "server-only";
import { db, hasDb } from "@/lib/db/client";
import { readDomain, writeDomain } from "./serverStore";

/**
 * Per-recipient send + engagement records for Farming campaigns. One row per
 * (campaign, contact). Postgres `farming_sends` when a DB is configured — so a
 * campaign to millions of recipients stays row-scoped and its open/click/
 * delivery/reply updates are idempotent — else a blob-map fallback for small/dev.
 * Counts for analytics come from SQL aggregates here, NOT from per-event writes
 * to the campaign blob (which would be a hot-spot at scale).
 */

const DOMAIN = "farming-sends";
type Field = "delivered_at" | "opened_at" | "clicked_at" | "replied_at";
const CAMEL: Record<Field, "deliveredAt" | "openedAt" | "clickedAt" | "repliedAt"> = {
  delivered_at: "deliveredAt", opened_at: "openedAt", clicked_at: "clickedAt", replied_at: "repliedAt",
};

export interface SendCounts { sent: number; delivered: number; opened: number; clicked: number; replied: number; }
interface BlobSend { status?: string; sentAt?: string; deliveredAt?: string; openedAt?: string; clickedAt?: string; repliedAt?: string }
type BlobMap = Record<string, BlobSend>; // key = `${campaignId}:${contactId}`

async function blob(): Promise<BlobMap> { return (await readDomain<BlobMap>(DOMAIN)) || {}; }

export async function recordSent(campaignId: string, contactId: string, status: "sent" | "failed" = "sent"): Promise<void> {
  if (hasDb()) {
    const sql = db()!;
    await sql`insert into farming_sends (campaign_id, contact_id, status, sent_at)
      values (${campaignId}, ${contactId}, ${status}, now())
      on conflict (campaign_id, contact_id) do update set status = excluded.status, sent_at = coalesce(farming_sends.sent_at, now())`;
    return;
  }
  const m = await blob(); const k = `${campaignId}:${contactId}`;
  m[k] = { ...(m[k] || {}), status, sentAt: m[k]?.sentAt || new Date().toISOString() };
  await writeDomain(DOMAIN, m);
}

// Set one timestamp field once (idempotent). Returns true only on the first time.
async function markOnce(campaignId: string, contactId: string, cols: Field[]): Promise<boolean> {
  if (hasDb()) {
    const sql = db()!;
    const setNull = cols.map((c) => `${c} is null`).join(" or ");
    const setNow = cols.map((c) => `${c} = coalesce(${c}, now())`).join(", ");
    // Try to fill any null target column on an existing row.
    const upd = await sql.unsafe(`update farming_sends set ${setNow} where campaign_id = $1 and contact_id = $2 and (${setNull}) returning 1`, [campaignId, contactId]);
    if (upd.length) return true;
    const ex = await sql.unsafe(`select 1 from farming_sends where campaign_id = $1 and contact_id = $2`, [campaignId, contactId]);
    if (!ex.length) {
      const colList = cols.join(", ");
      const nows = cols.map(() => "now()").join(", ");
      await sql.unsafe(`insert into farming_sends (campaign_id, contact_id, ${colList}) values ($1, $2, ${nows}) on conflict (campaign_id, contact_id) do nothing`, [campaignId, contactId]);
      return true;
    }
    return false;
  }
  const m = await blob(); const k = `${campaignId}:${contactId}`; const rec = (m[k] = m[k] || {});
  const fields = cols.map((c) => CAMEL[c]);
  const already = fields.every((f) => rec[f]);
  if (already) return false;
  const now = new Date().toISOString();
  for (const f of fields) if (!rec[f]) rec[f] = now;
  await writeDomain(DOMAIN, m);
  return true;
}

// An open implies delivery; a click implies open + delivery.
export const markDelivered = (c: string, id: string) => markOnce(c, id, ["delivered_at"]);
export const markOpened = (c: string, id: string) => markOnce(c, id, ["opened_at", "delivered_at"]);
export const markClicked = (c: string, id: string) => markOnce(c, id, ["clicked_at", "opened_at", "delivered_at"]);
export const markReplied = (c: string, id: string) => markOnce(c, id, ["replied_at"]);

export async function markFailed(campaignId: string, contactId: string): Promise<void> {
  if (hasDb()) { const sql = db()!; await sql`update farming_sends set status = 'failed' where campaign_id = ${campaignId} and contact_id = ${contactId}`; return; }
  const m = await blob(); const k = `${campaignId}:${contactId}`; m[k] = { ...(m[k] || {}), status: "failed" }; await writeDomain(DOMAIN, m);
}

export async function campaignCounts(campaignId: string): Promise<SendCounts> {
  if (hasDb()) {
    const sql = db()!;
    const [r] = await sql<SendCounts[]>`select
      count(*)::int sent, count(delivered_at)::int delivered, count(opened_at)::int opened,
      count(clicked_at)::int clicked, count(replied_at)::int replied
      from farming_sends where campaign_id = ${campaignId}`;
    return r;
  }
  const m = await blob(); const c: SendCounts = { sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0 };
  for (const [k, v] of Object.entries(m)) { if (!k.startsWith(campaignId + ":")) continue; c.sent++; if (v.deliveredAt) c.delivered++; if (v.openedAt) c.opened++; if (v.clickedAt) c.clicked++; if (v.repliedAt) c.replied++; }
  return c;
}

export async function allCampaignCounts(): Promise<Record<string, SendCounts>> {
  if (hasDb()) {
    const sql = db()!;
    const rows = await sql<(SendCounts & { campaign_id: string })[]>`select campaign_id,
      count(*)::int sent, count(delivered_at)::int delivered, count(opened_at)::int opened,
      count(clicked_at)::int clicked, count(replied_at)::int replied
      from farming_sends group by campaign_id`;
    const out: Record<string, SendCounts> = {};
    for (const r of rows) out[r.campaign_id] = { sent: r.sent, delivered: r.delivered, opened: r.opened, clicked: r.clicked, replied: r.replied };
    return out;
  }
  const m = await blob(); const out: Record<string, SendCounts> = {};
  for (const [k, v] of Object.entries(m)) { const cid = k.split(":")[0]; const c = (out[cid] = out[cid] || { sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0 }); c.sent++; if (v.deliveredAt) c.delivered++; if (v.openedAt) c.opened++; if (v.clickedAt) c.clicked++; if (v.repliedAt) c.replied++; }
  return out;
}

export interface SendRow { contactId: string; status: string; deliveredAt?: string; openedAt?: string; clickedAt?: string; repliedAt?: string }
export async function listSends(campaignId: string, offset = 0, limit = 100): Promise<SendRow[]> {
  if (hasDb()) {
    const sql = db()!;
    const rows = await sql<{ contact_id: string; status: string; delivered_at?: string; opened_at?: string; clicked_at?: string; replied_at?: string }[]>`select contact_id, status, delivered_at, opened_at, clicked_at, replied_at from farming_sends where campaign_id = ${campaignId} order by sent_at desc nulls last limit ${limit} offset ${offset}`;
    return rows.map((r) => ({ contactId: r.contact_id, status: r.status, deliveredAt: r.delivered_at || undefined, openedAt: r.opened_at || undefined, clickedAt: r.clicked_at || undefined, repliedAt: r.replied_at || undefined }));
  }
  const m = await blob();
  return Object.entries(m).filter(([k]) => k.startsWith(campaignId + ":")).slice(offset, offset + limit)
    .map(([k, v]) => ({ contactId: k.slice(campaignId.length + 1), status: v.status || "sent", deliveredAt: v.deliveredAt, openedAt: v.openedAt, clickedAt: v.clickedAt, repliedAt: v.repliedAt }));
}
