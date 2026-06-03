import type { LFOrderBody, LFResult } from "./lifefileTypes";

/* ────────────────────────────────────────────────────────────────────────
   Life File (LifeFile) API — SERVER ONLY.

   To go live, set in .env.local:
     LIFEFILE_API_USER   = sandboxapi11437-280
     LIFEFILE_API_PASS   = (password)
   The sandbox config IDs default below; override if needed:
     LIFEFILE_API_BASE   = https://host100-7.lifefile.net/lfapi/v1
     LIFEFILE_VENDOR_ID  = 11504
     LIFEFILE_LOCATION_ID= 110285
     LIFEFILE_NETWORK_ID = 1481
     LIFEFILE_PRACTICE_ID= 1022889

   Auth = HTTP Basic + the three required headers (X-Vendor-ID / X-Location-ID /
   X-API-Network-ID). Without API user/pass it returns a MOCK so the flow is
   demoable. Credentials never reach the browser — the app talks to
   /api/pharmacy/lifefile/*.
   ──────────────────────────────────────────────────────────────────────── */

const BASE = process.env.LIFEFILE_API_BASE || "https://host100-7.lifefile.net/lfapi/v1";
const USER = process.env.LIFEFILE_API_USER;
const PASS = process.env.LIFEFILE_API_PASS;
const VENDOR = process.env.LIFEFILE_VENDOR_ID || "11504";
const LOCATION = process.env.LIFEFILE_LOCATION_ID || "110285";
const NETWORK = process.env.LIFEFILE_NETWORK_ID || "1481";
const PRACTICE = process.env.LIFEFILE_PRACTICE_ID || "1022889";

const live = () => !!(USER && PASS);
function headers(json = false): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: "Basic " + Buffer.from(`${USER}:${PASS}`).toString("base64"),
    "X-Vendor-ID": VENDOR, "X-Location-ID": LOCATION, "X-API-Network-ID": NETWORK, Accept: "application/json",
  };
  if (json) h["Content-Type"] = "application/json";
  return h;
}
function hash(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

export async function lfSubmit(body: LFOrderBody): Promise<LFResult> {
  // The practice id lives in config, not the browser — inject it server-side.
  body.order.practice = body.order.practice ?? { id: Number(PRACTICE) };
  if (!live()) {
    const orderId = 24200000 + (hash(JSON.stringify(body.order.rxs) + Date.now()) % 799999);
    return { ok: true, type: "success", message: "Order created (mock).", orderId, source: "mock" };
  }
  try {
    const r = await fetch(`${BASE}/order`, { method: "POST", headers: headers(true), body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.type === "error") return { ok: false, type: "error", message: j?.message, error: j?.message || `HTTP ${r.status}`, source: "lifefile" };
    const orderId = j?.data?.orderId ?? j?.data?.id ?? j?.orderId;
    return { ok: true, type: "success", message: j?.message, orderId, data: j?.data, source: "lifefile" };
  } catch { return { ok: false, error: "Could not reach Life File.", source: "lifefile" }; }
}

export async function lfSetStatus(orderId: string, statusId: string): Promise<LFResult> {
  if (!live()) return { ok: true, type: "success", message: `(mock) Set status ${statusId} on order ${orderId}.`, source: "mock" };
  try {
    const r = await fetch(`${BASE}/order/${orderId}/status`, { method: "PUT", headers: headers(true), body: JSON.stringify({ status: statusId }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.type === "error") return { ok: false, error: j?.message || `HTTP ${r.status}`, source: "lifefile" };
    return { ok: true, type: "success", message: j?.message || "Status updated.", source: "lifefile" };
  } catch { return { ok: false, error: "Could not reach Life File.", source: "lifefile" }; }
}
