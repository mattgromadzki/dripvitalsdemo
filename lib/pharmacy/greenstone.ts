import type { GsOrderInput, GsSubmitResult, GsStatusResult } from "./greenstoneTypes";

/* ────────────────────────────────────────────────────────────────────────
   GreenstoneRX — 5Axis Pharmacy Orders API v2. SERVER ONLY.

   Env:
     GREENSTONE_API_TOKEN        sent in the `token` header (from 5Axis)
     GREENSTONE_PHARMACY_NCPDPID the pharmacy's NCPDP ID
     GREENSTONE_CLINIC           your clinic identifier at 5Axis
     GREENSTONE_BASE_URL         optional; defaults to the sandbox host
        sandbox: https://sandbox-pharmacy.5axis.health
        prod:    https://pharmacy.5axis.health

   Auth = an API token in the `token` header. The orders endpoint is a single
   multiplexed POST (insert_one / find_one / update_one). Without a token (e.g.
   this sandbox) every call returns a realistic MOCK so the submit→track loop is
   demoable. Credentials never reach the browser — the app only calls
   /api/pharmacy/greenstone/*.
   ──────────────────────────────────────────────────────────────────────── */

const BASE = process.env.GREENSTONE_BASE_URL || "https://sandbox-pharmacy.5axis.health";
const TOKEN = process.env.GREENSTONE_API_TOKEN;
const NCPDP = process.env.GREENSTONE_PHARMACY_NCPDPID || "";
const CLINIC = process.env.GREENSTONE_CLINIC || "";
const ORDERS_PATH = "/pharmacy/orders_api_v2/";

const live = () => !!TOKEN;
export function greenstoneConfigured(): boolean { return live(); }

function headers(): Record<string, string> {
  return { "Content-Type": "application/json", Accept: "application/json", token: TOKEN || "" };
}

function buildDocument(input: GsOrderInput) {
  return {
    internal_order_id: input.internalOrderId,
    internal_customer_id: input.internalCustomerId,
    clinic: CLINIC.toUpperCase(),
    status: "TO_BE_FILLED",
    pharmacy_ncpdpid: NCPDP,
    firstName: input.firstName,
    lastName: input.lastName,
    dob: input.dob,
    gender: input.gender,
    email: input.email,
    phoneNumber: input.phoneNumber,
    address: {
      address: input.address.address,
      line2: input.address.line2,
      city: input.address.city,
      state: String(input.address.state || "").trim().toUpperCase().slice(0, 2),
      zipCode: String(input.address.zipCode || "").trim(),
    },
    scripts: input.scripts.map((s) => ({
      name: s.name,
      dispense_quantity: s.dispense_quantity,
      dispense_unit: s.dispense_unit,
      sig: s.sig,
      doctor: s.doctor,
      doctor_name: s.doctor_name,
      doctor_npi: s.doctor_npi,
      number_refills: s.number_refills ?? 0,
      date_prescribed: s.date_prescribed,
    })),
    delivery_type: input.deliveryType || "direct",
    order_recieved_at: new Date().toISOString().slice(0, 19).replace("T", " "), // "YYYY-MM-DD HH:MM:SS" (note: spec spells it "recieved")
    creation_timeStamp: Date.now(), // milliseconds since epoch, per 5Axis spec
  };
}

// ── Submit an order (insert_one) ──────────────────────────────────────────
export async function greenstoneSubmit(input: GsOrderInput): Promise<GsSubmitResult> {
  if (!live()) {
    return { ok: true, orderId: "GS-MOCK-" + Date.now().toString(36), message: "Mock order accepted (no GREENSTONE_API_TOKEN set).", source: "mock" };
  }
  try {
    const body = { query_type: "insert_one", query_params: { document: buildDocument(input) } };
    const r = await fetch(`${BASE}${ORDERS_PATH}`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.success !== 1) {
      const host = BASE.replace(/^https?:\/\//, "");
      return { ok: false, error: `${j?.message || `Pharmacy rejected the order (HTTP ${r.status}).`} [endpoint: ${host}]`, warnings: j?.warnings, source: "greenstone" };
    }
    const d = (j && typeof j.data === "object" && j.data) ? j.data : {};
    const orderId =
      j.order_id ?? j.orderId ?? j.id ??
      d.order_id ?? d.orderId ?? d._id ?? d.id;
    return { ok: true, orderId, message: j.message, warnings: j.warnings, source: "greenstone", raw: j };
  } catch {
    return { ok: false, error: "Could not reach the pharmacy API.", source: "greenstone" };
  }
}

// ── Query an order's status (find_one) ────────────────────────────────────
export async function greenstoneStatus(filter: { order_id?: number | string; internal_order_id?: string }): Promise<GsStatusResult> {
  if (!live()) {
    return { ok: true, orderId: filter.order_id ?? filter.internal_order_id, status: "TO_BE_FILLED", source: "mock" };
  }
  try {
    const filters: Record<string, unknown> = {};
    if (filter.order_id != null) filters.order_id = filter.order_id;
    if (filter.internal_order_id) filters.internal_order_id = filter.internal_order_id;
    const body = { query_type: "find_one", query_params: { filters } };
    const r = await fetch(`${BASE}${ORDERS_PATH}`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.success !== 1) return { ok: false, error: j?.message || `Status lookup failed (HTTP ${r.status}).`, source: "greenstone" };
    const doc = (j.data || {}) as Record<string, unknown>;
    return {
      ok: true,
      orderId: (doc.order_id as number) ?? filter.order_id,
      status: doc.status as string | undefined,
      trackingNumber: doc.tracking_number as string | undefined,
      trackingUrl: doc.tracking_url as string | undefined,
      document: doc,
      source: "greenstone",
    };
  } catch {
    return { ok: false, error: "Could not reach the pharmacy API.", source: "greenstone" };
  }
}

/**
 * Cancel an order at GreenstoneRX via the 5Axis update_one operation, setting
 * the order status to CANCELLED. Per the API spec:
 *   { query_type: "update_one",
 *     query_params: { filters: { order_id | internal_order_id }, values: { "$set": { status: "CANCELLED" } } } }
 * Returns ok only when the API responds success:1. Direct status cancellation is
 * honored for early-stage orders; once a label exists the pharmacy may reject it
 * (route through their pull-live flow), and that rejection is surfaced as `error`.
 */
export async function greenstoneCancel(filter: { order_id?: number | string; internal_order_id?: string }): Promise<GsSubmitResult> {
  if (!live()) {
    return { ok: true, orderId: filter.order_id ?? filter.internal_order_id, message: "Mock cancel (no token set).", source: "mock" };
  }
  try {
    const filters: Record<string, unknown> = {};
    if (filter.order_id != null) filters.order_id = filter.order_id;
    else if (filter.internal_order_id) filters.internal_order_id = filter.internal_order_id;
    const body = { query_type: "update_one", query_params: { filters, values: { $set: { status: "CANCELLED" } } } };
    const r = await fetch(`${BASE}${ORDERS_PATH}`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.success !== 1) {
      const host = BASE.replace(/^https?:\/\//, "");
      return { ok: false, error: `${j?.message || `Pharmacy rejected the cancellation (HTTP ${r.status}).`} [endpoint: ${host}]`, source: "greenstone" };
    }
    return { ok: true, orderId: filter.order_id ?? filter.internal_order_id, message: j?.message, source: "greenstone" };
  } catch (e) {
    return { ok: false, error: `Cancellation request failed: ${(e as Error).message}`, source: "greenstone" };
  }
}

// ── Order messaging (5Axis order message thread) ───────────────────────────
// POST/GET /api/v1/orders/{order_id}/messages — two-way notes between the
// clinic and the pharmacist on a specific order.
export interface GsMessage { id: string; orderId: string | number; clinic?: string; senderType: "clinic" | "pharmacy"; senderName?: string; message: string; createdAt: string; read?: boolean }
export interface GsMessagesResult { ok: boolean; messages?: GsMessage[]; totalCount?: number; error?: string; source: "greenstone" | "mock" }
export interface GsSendMessageResult { ok: boolean; messageId?: string; createdAt?: string; error?: string; source: "greenstone" | "mock" }

const messagesPath = (orderId: string | number) => `/api/v1/orders/${encodeURIComponent(String(orderId))}/messages`;

export async function greenstoneListMessages(orderId: string | number): Promise<GsMessagesResult> {
  if (!live()) return { ok: true, messages: [], totalCount: 0, source: "mock" };
  try {
    const r = await fetch(`${BASE}${messagesPath(orderId)}`, { method: "GET", headers: headers() });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.success !== 1) return { ok: false, error: j?.message || `Message lookup failed (HTTP ${r.status}).`, source: "greenstone" };
    const list = (j?.data?.messages || []) as Array<Record<string, unknown>>;
    return {
      ok: true,
      totalCount: (j?.data?.total_count as number) ?? list.length,
      messages: list.map((m) => ({
        id: String(m._id ?? m.message_id ?? ""),
        orderId: (m.order_id as string | number) ?? orderId,
        clinic: m.clinic as string | undefined,
        senderType: (m.sender_type as "clinic" | "pharmacy") ?? "pharmacy",
        senderName: m.sender_name as string | undefined,
        message: String(m.message ?? ""),
        createdAt: String(m.created_at ?? ""),
        read: m.read as boolean | undefined,
      })),
      source: "greenstone",
    };
  } catch (e) { return { ok: false, error: `Message lookup failed: ${(e as Error).message}`, source: "greenstone" }; }
}

export async function greenstoneSendMessage(orderId: string | number, message: string): Promise<GsSendMessageResult> {
  const msg = (message || "").trim();
  if (!msg) return { ok: false, error: "Message is empty.", source: "greenstone" };
  if (msg.length > 2000) return { ok: false, error: "Message exceeds the 2000-character limit.", source: "greenstone" };
  if (!live()) return { ok: true, messageId: "mock-" + Date.now(), createdAt: new Date().toISOString(), source: "mock" };
  try {
    const r = await fetch(`${BASE}${messagesPath(orderId)}`, { method: "POST", headers: headers(), body: JSON.stringify({ message: msg }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.success !== 1) return { ok: false, error: j?.message || `Send failed (HTTP ${r.status}).`, source: "greenstone" };
    return { ok: true, messageId: j?.data?.message_id, createdAt: j?.data?.created_at, source: "greenstone" };
  } catch (e) { return { ok: false, error: `Send failed: ${(e as Error).message}`, source: "greenstone" }; }
}

// ── Shipping address update (5Axis PUT /orders/{order_id}/update-address) ────
// For early orders the change applies directly (HTTP 200). Once a label exists
// (LABEL_CREATED / ISSUE_IN_SHIPPING) the API requires force:true and routes the
// change through a pharmacist-reviewed pull-live request (HTTP 202).
export interface GsAddressBody { address: string; city: string; state: string; zipCode: string; line2?: string; force?: boolean; note?: string; skip_validation?: boolean }
export interface GsAddressResult { ok: boolean; pullLive?: boolean; message?: string; error?: string; source: "greenstone" | "mock" }

export async function greenstoneUpdateAddress(orderId: string | number, body: GsAddressBody): Promise<GsAddressResult> {
  if (!live()) return { ok: true, message: "Mock address update (no token set).", source: "mock" };
  try {
    const r = await fetch(`${BASE}/api/v1/orders/${encodeURIComponent(String(orderId))}/update-address`, {
      method: "PUT", headers: headers(), body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 202) return { ok: true, pullLive: true, message: j?.message || "Queued for pharmacist review (order already has a label).", source: "greenstone" };
    if (!r.ok || j?.success !== 1) {
      const host = BASE.replace(/^https?:\/\//, "");
      const hint = r.status === 409 ? " The order already has a shipping label — resend with force to route it through pharmacist review." : "";
      return { ok: false, error: `${j?.message || `Address update failed (HTTP ${r.status}).`}${hint} [endpoint: ${host}]`, source: "greenstone" };
    }
    return { ok: true, message: j?.message || "Shipping address updated.", source: "greenstone" };
  } catch (e) { return { ok: false, error: `Address update failed: ${(e as Error).message}`, source: "greenstone" }; }
}
