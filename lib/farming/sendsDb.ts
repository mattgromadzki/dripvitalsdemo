import "server-only";
import { db, hasDb } from "@/lib/db/client";
import { readDomain, writeDomain } from "./serverStore";

/**
 * Per-recipient send + engagement records for Farming campaigns. One row per
 * (campaign, contact). Postgres `farming_sends` when a DB is configured — so a
 * campaign to millions of recipients stays row-scoped and its open/click/
 * delivery/reply/bounce/unsub updates are idempotent — else a blob-map fallback.
 * Counts for analytics come from SQL aggregates here, NOT from per-event writes
 * to the campaign blob (which would be a hot-spot at scale).
 */

const DOMAIN = "farming-sends";
type Field = "delivered_at" | "opened_at" | "clicked_at" | "replied_at";
const CAMEL: Record<Field, "deliveredAt" | "openedAt" | "clickedAt" | "repliedAt"> = {
  delivered_at: "deliveredAt", opened_at: "openedAt", clicked_at: "clickedAt", replied_at: "repliedAt",
};

export interface SendCounts { sent: number; delivered: number; opened: number; clicked: number; replied: number; bounced: number; unsubscribed: number; failed: number; }
const ZERO: SendCounts = { sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0, bounced: 0, unsubscribed: 0, failed: 0 };
interface BlobSend { status?: string; sentAt?: string; deliveredAt?: string; openedAt?: string; clickedAt?: string; repliedAt?: string; bouncedAt?: string; unsubscribedAt?: string }
type BlobMap = Record<string, BlobSend>; // key = `${campaignId}:${contactId}`

async function blob(): Promise<BlobMap> { return (await readDomain<BlobMap>(DOMAIN)) || {}; }
const tally = (v: BlobSend, c: SendCounts) => {
  c.sent++;
  if (v.deliveredAt) c.delivered++; if (v.openedAt) c.opened++; if (v.clickedAt) c.clicked++;
  if (v.repliedAt) c.replied++; if (v.bouncedAt) c.bounced++; if (v.unsubscribedAt) c.unsubscribed++;
  if (v.status === "failed") c.failed++;
};

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

export async function markBounced(campaignId: string, contactId: string): Promise<void> {
  if (hasDb()) { const sql = db()!; await sql`update farming_sends set bounced_at = coalesce(bounced_at, now()), status = 'bounced' where campaign_id = ${campaignId} and contact_id = ${contactId}`; return; }
  const m = await blob(); const k = `${campaignId}:${contactId}`; m[k] = { ...(m[k] || {}), status: "bounced", bouncedAt: m[k]?.bouncedAt || new Date().toISOString() }; await writeDomain(DOMAIN, m);
}

export async function markUnsubscribed(campaignId: string, contactId: string): Promise<void> {
  if (hasDb()) { const sql = db()!; await sql`update farming_sends set unsubscribed_at = coalesce(unsubscribed_at, now()) where campaign_id = ${campaignId} and contact_id = ${contactId}`; return; }
  const m = await blob(); const k = `${campaignId}:${contactId}`; m[k] = { ...(m[k] || {}), unsubscribedAt: m[k]?.unsubscribedAt || new Date().toISOString() }; await writeDomain(DOMAIN, m);
}

const COUNT_COLS = (sql: NonNullable<ReturnType<typeof db>>) => sql`
  count(*)::int sent, count(delivered_at)::int delivered, count(opened_at)::int opened,
  count(clicked_at)::int clicked, count(replied_at)::int replied, count(bounced_at)::int bounced,
  count(unsubscribed_at)::int unsubscribed, count(*) filter (where status = 'failed')::int failed`;

export async function campaignCounts(campaignId: string): Promise<SendCounts> {
  if (hasDb()) {
    const sql = db()!;
    const [r] = await sql<SendCounts[]>`select ${COUNT_COLS(sql)} from farming_sends where campaign_id = ${campaignId}`;
    return r;
  }
  const m = await blob(); const c: SendCounts = { ...ZERO };
  for (const [k, v] of Object.entries(m)) { if (!k.startsWith(campaignId + ":")) continue; tally(v, c); }
  return c;
}

export async function allCampaignCounts(): Promise<Record<string, SendCounts>> {
  if (hasDb()) {
    const sql = db()!;
    const rows = await sql<(SendCounts & { campaign_id: string })[]>`select campaign_id, ${COUNT_COLS(sql)} from farming_sends group by campaign_id`;
    const out: Record<string, SendCounts> = {};
    for (const r of rows) { const { campaign_id, ...rest } = r; out[campaign_id] = rest; }
    return out;
  }
  const m = await blob(); const out: Record<string, SendCounts> = {};
  for (const [k, v] of Object.entries(m)) { const cid = k.split(":")[0]; const c = (out[cid] = out[cid] || { ...ZERO }); tally(v, c); }
  return out;
}

// Recipient-level report row.
export interface SendRow { contactId: string; status: string; sentAt?: string; deliveredAt?: string; openedAt?: string; clickedAt?: string; repliedAt?: string; bouncedAt?: string; unsubscribedAt?: string }
export type SendFilter = "all" | "delivered" | "opened" | "clicked" | "replied" | "bounced" | "unsubscribed" | "not_opened";

function blobMatch(v: BlobSend, f: SendFilter): boolean {
  switch (f) {
    case "delivered": return !!v.deliveredAt;
    case "opened": return !!v.openedAt;
    case "clicked": return !!v.clickedAt;
    case "replied": return !!v.repliedAt;
    case "bounced": return !!v.bouncedAt;
    case "unsubscribed": return !!v.unsubscribedAt;
    case "not_opened": return !v.openedAt && v.status !== "bounced";
    default: return true;
  }
}
function whereClause(sql: NonNullable<ReturnType<typeof db>>, campaignId: string, f: SendFilter) {
  const base = sql`campaign_id = ${campaignId}`;
  switch (f) {
    case "delivered": return sql`${base} and delivered_at is not null`;
    case "opened": return sql`${base} and opened_at is not null`;
    case "clicked": return sql`${base} and clicked_at is not null`;
    case "replied": return sql`${base} and replied_at is not null`;
    case "bounced": return sql`${base} and bounced_at is not null`;
    case "unsubscribed": return sql`${base} and unsubscribed_at is not null`;
    case "not_opened": return sql`${base} and opened_at is null and status <> 'bounced'`;
    default: return base;
  }
}

export async function listSends(campaignId: string, offset = 0, limit = 100, filter: SendFilter = "all"): Promise<SendRow[]> {
  if (hasDb()) {
    const sql = db()!;
    const rows = await sql<{ contact_id: string; status: string; sent_at?: string; delivered_at?: string; opened_at?: string; clicked_at?: string; replied_at?: string; bounced_at?: string; unsubscribed_at?: string }[]>`
      select contact_id, status, sent_at, delivered_at, opened_at, clicked_at, replied_at, bounced_at, unsubscribed_at
      from farming_sends where ${whereClause(sql, campaignId, filter)} order by sent_at desc nulls last limit ${limit} offset ${offset}`;
    return rows.map((r) => ({ contactId: r.contact_id, status: r.status, sentAt: r.sent_at || undefined, deliveredAt: r.delivered_at || undefined, openedAt: r.opened_at || undefined, clickedAt: r.clicked_at || undefined, repliedAt: r.replied_at || undefined, bouncedAt: r.bounced_at || undefined, unsubscribedAt: r.unsubscribed_at || undefined }));
  }
  const m = await blob();
  return Object.entries(m).filter(([k]) => k.startsWith(campaignId + ":")).filter(([, v]) => blobMatch(v, filter)).slice(offset, offset + limit)
    .map(([k, v]) => ({ contactId: k.slice(campaignId.length + 1), status: v.status || "sent", sentAt: v.sentAt, deliveredAt: v.deliveredAt, openedAt: v.openedAt, clickedAt: v.clickedAt, repliedAt: v.repliedAt, bouncedAt: v.bouncedAt, unsubscribedAt: v.unsubscribedAt }));
}

export async function countSends(campaignId: string, filter: SendFilter = "all"): Promise<number> {
  if (hasDb()) {
    const sql = db()!;
    const [r] = await sql<{ n: number }[]>`select count(*)::int n from farming_sends where ${whereClause(sql, campaignId, filter)}`;
    return r.n;
  }
  const m = await blob();
  return Object.entries(m).filter(([k]) => k.startsWith(campaignId + ":")).filter(([, v]) => blobMatch(v, filter)).length;
}
