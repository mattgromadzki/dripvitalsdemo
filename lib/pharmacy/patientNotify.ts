import "server-only";
import { Redis } from "@upstash/redis";
import { hasDb } from "@/lib/db/client";
import { dbGetDomain, dbSetDomain } from "@/lib/db/store";
import { sendSms } from "@/lib/sms/provider";
import { sendEmail } from "@/lib/email/provider";

/**
 * Notifies a patient by SMS + email when their pharmacy order reaches a
 * shipment-relevant stage, including the carrier tracking number/URL.
 *
 * De-duplicates on (order_id, status) so webhook retries — or repeated events
 * for the same transition — never double-text or double-email a patient. The
 * notified-set is persisted via the same Postgres -> Upstash -> memory chain
 * as the rest of the pharmacy event log.
 */

const DOMAIN = "pharmacy-notified";
const KEY = `store:${DOMAIN}`;
const mem: { v: string[] } = { v: [] };

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}
async function readNotified(): Promise<string[]> {
  try {
    if (hasDb()) { const d = await dbGetDomain(DOMAIN); return Array.isArray(d) ? (d as string[]) : []; }
    const r = redis();
    if (r) { const v = await r.get(KEY); const d = typeof v === "string" ? JSON.parse(v) : v; return Array.isArray(d) ? (d as string[]) : []; }
  } catch { /* ignore */ }
  return mem.v;
}
async function writeNotified(list: string[]): Promise<void> {
  if (hasDb()) await dbSetDomain(DOMAIN, list);
  else { const r = redis(); if (r) await r.set(KEY, JSON.stringify(list)); else mem.v = list; }
}

export interface ShipmentNotifyInput {
  orderId?: string | number;
  patientName?: string;
  email?: string;
  phone?: string;
  stage?: string;   // requested|filling|ready|shipped|delivered|issue
  status?: string;  // raw 5Axis status
  trackingNumber?: string;
  trackingUrl?: string;
  brandId?: string;
}

// Only these stages warrant a patient notification.
const STAGE_HEADLINE: Record<string, string> = {
  ready:     "has shipped",
  shipped:   "is on its way",
  delivered: "has been delivered",
  issue:     "has a shipping issue we're resolving",
};

export async function notifyPatientShipment(input: ShipmentNotifyInput): Promise<void> {
  const stage = (input.stage || "").toLowerCase();
  const headline = STAGE_HEADLINE[stage];
  if (!headline) return; // pre-ship stages (requested/filling) don't notify

  // Idempotency: one notification per (order, status).
  const dedupeKey = `${input.orderId ?? "?"}:${(input.status || stage).toUpperCase()}`;
  const notified = await readNotified();
  if (notified.includes(dedupeKey)) return;

  const firstName = (input.patientName || "").trim().split(/\s+/)[0] || "there";
  const trackNum = (input.trackingNumber || "").trim();
  const trackUrl = (input.trackingUrl || "").trim();

  // ── SMS ──
  if (input.phone) {
    const smsTrack = trackNum ? ` Track: ${trackUrl || trackNum}` : "";
    const body = `DripVitals: your order ${headline}.${smsTrack}`.trim();
    try { await sendSms({ to: input.phone, body }, input.brandId); } catch { /* best-effort */ }
  }

  // ── Email ──
  if (input.email) {
    const subject =
      stage === "delivered" ? "Your DripVitals order was delivered"
      : stage === "issue"   ? "Update on your DripVitals order"
      : "Your DripVitals order has shipped";
    const trackHtml = trackNum
      ? `<p style="margin:16px 0;">Tracking number: <strong>${trackNum}</strong>${trackUrl ? `<br/><a href="${trackUrl}" style="color:#4a8ec7;">Track your package &rarr;</a>` : ""}</p>`
      : "";
    const html = `<div style="font-family:system-ui,-apple-system,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a;">
      <p>Hi ${firstName},</p>
      <p>Your DripVitals order <strong>${headline}</strong>.</p>
      ${trackHtml}
      <p style="color:#666;font-size:13px;margin-top:24px;">Questions? Just reply to this email and our care team will help.</p>
    </div>`;
    const from = process.env.EMAIL_FROM_ORDERS || process.env.EMAIL_FROM || undefined;
    try { await sendEmail({ to: input.email, toName: input.patientName, subject, html, from }, input.brandId); } catch { /* best-effort */ }
  }

  notified.push(dedupeKey);
  await writeNotified(notified.slice(-5000));
}
