import type { EmedOrderPayload, EmedSubmitResult, EmedOrderStatus, EmedRxStatus, EmedCancelResult } from "./types";
import { EMED_STATUSES } from "./types";

/* ────────────────────────────────────────────────────────────────────────
   eMed pharmacy fulfillment API — SERVER ONLY.

   To go live, set in .env.local:
     EMED_USERNAME = Drip.Vitals
     EMED_PASSWORD = (your password)
     EMED_CUSTOMER = RHJpcCBWaXRhbHM=        (base64 of "Drip Vitals")
     EMED_BASE_URL = https://emed.azurewebsites.net/api/public/emed   (optional)

   Auth = HTTP Basic (user:pass, base64) + a "Customer" header (base64 name).
   Without credentials (e.g. this sandbox) every call returns a realistic MOCK,
   so the whole submit → track → cancel loop is demoable. Credentials never
   reach the browser — the app only ever talks to /api/pharmacy/*.
   ──────────────────────────────────────────────────────────────────────── */

const BASE = process.env.EMED_BASE_URL || "https://emed.azurewebsites.net/api/public/emed";
const USER = process.env.EMED_USERNAME;
const PASS = process.env.EMED_PASSWORD;
const CUSTOMER = process.env.EMED_CUSTOMER || "";

const live = () => !!(USER && PASS);
function headers(json = false): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: "Basic " + Buffer.from(`${USER}:${PASS}`).toString("base64"),
    Customer: CUSTOMER,
    Accept: "application/json",
  };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

function hash(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

// ── Submit ────────────────────────────────────────────────────────────────
export async function emedSubmit(payload: EmedOrderPayload): Promise<EmedSubmitResult> {
  if (!live()) return mockSubmit(payload);
  try {
    const r = await fetch(`${BASE}/order/`, { method: "POST", headers: headers(true), body: JSON.stringify(payload) });
    if (!r.ok) return { ok: false, error: `Pharmacy rejected the order (HTTP ${r.status}).`, source: "emed" };
    const j = await r.json();
    if (j?.OrderId == null) return { ok: false, error: "No OrderId returned — order was not created.", source: "emed" };
    return { ok: true, OrderId: j.OrderId, Rx: Array.isArray(j.Rx) ? j.Rx : [], source: "emed" };
  } catch {
    return { ok: false, error: "Could not reach the pharmacy API.", source: "emed" };
  }
}

// ── Order status ────────────────────────────────────────────────────────
export async function emedOrderStatus(id: string): Promise<EmedOrderStatus> {
  if (!live()) return mockOrderStatus(id);
  try {
    const r = await fetch(`${BASE}/order/${id}`, { headers: headers() });
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}`, source: "emed" };
    const j = await r.json();
    return { ok: true, ...j, source: "emed" };
  } catch { return { ok: false, error: "Could not reach the pharmacy API.", source: "emed" }; }
}

// ── Rx status ─────────────────────────────────────────────────────────────
export async function emedRxStatus(id: string): Promise<EmedRxStatus> {
  if (!live()) return mockRxStatus(id);
  try {
    const r = await fetch(`${BASE}/rx/${id}`, { headers: headers() });
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}`, source: "emed" };
    const j = await r.json();
    return { ok: true, ...j, source: "emed" };
  } catch { return { ok: false, error: "Could not reach the pharmacy API.", source: "emed" }; }
}

// ── Cancel ────────────────────────────────────────────────────────────────
export async function emedCancel(id: string): Promise<EmedCancelResult> {
  if (!live()) return mockCancel(id);
  try {
    const r = await fetch(`${BASE}/order/${id}`, { method: "DELETE", headers: headers() });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: j?.error || `HTTP ${r.status}`, source: "emed" };
    return { ok: true, message: j?.message || `Cancelled OrderId ${id}`, source: "emed" };
  } catch { return { ok: false, error: "Could not reach the pharmacy API.", source: "emed" }; }
}

/* ── Mocks ───────────────────────────────────────────────────────────────── */
function mockSubmit(payload: EmedOrderPayload): EmedSubmitResult {
  const seed = hash(JSON.stringify(payload.Drug) + Date.now());
  const OrderId = 1000000 + (seed % 900000);
  const Rx = (payload.Drug || []).map((d, i) => ({ Id: OrderId * 10 + i + 1, Drug: d.Name }));
  return { ok: true, OrderId, Rx, source: "mock" };
}
function mockRxStatus(id: string): EmedRxStatus {
  const n = parseInt(id.replace(/\D/g, ""), 10) || 0;
  const status = EMED_STATUSES[n % EMED_STATUSES.length];
  const shipped = status === "Shipped";
  return {
    ok: true, RxId: n, OrderStatus: status, ScriptNumber: 390000 + (n % 9999),
    DrugName: "(see order)", Sigs: "Use as directed",
    ShipDate: shipped ? "2026-06-01" : undefined,
    ShipmentType: shipped ? "FedEx: FedEx 2Day" : undefined,
    TrackingNumber: shipped ? String(390000000000 + (n % 999999999)) : undefined,
    LastModified: new Date().toISOString(), source: "mock",
  };
}
function mockOrderStatus(id: string): EmedOrderStatus {
  const n = parseInt(id.replace(/\D/g, ""), 10) || 0;
  const shipState = n % 3 === 0 ? "Shipped" : n % 3 === 1 ? "Not Shipped" : "Picked Up";
  const shipped = shipState !== "Not Shipped";
  return {
    ok: true, OrderId: n, Status: "Externally Prescribed", Prescriber: "Dr. Rivera", Pharmacy: "RXCompound Store",
    ShipStatus: shipState,
    ShipDate: shipped ? "2026-06-01" : undefined,
    ShipmentType: shipped ? "FedEx: FedEx 2Day" : undefined,
    TrackingNumber: shipped ? String(390000000000 + (n % 999999999)) : undefined,
    PackageCount: shipped ? 1 : undefined, source: "mock",
  };
}
function mockCancel(id: string): EmedCancelResult {
  const n = parseInt(id.replace(/\D/g, ""), 10) || 0;
  if (n % 3 === 0) return { ok: false, error: "Order is not able to be cancelled because it is already shipped or picked up.", source: "mock" };
  return { ok: true, message: `Successfully cancelled OrderId: ${id}`, source: "mock" };
}
