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
    clinic: CLINIC,
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
      state: input.address.state,
      zipCode: input.address.zipCode,
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
      daw: s.daw,
    })),
    delivery_type: input.deliveryType || "direct",
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
      return { ok: false, error: j?.message || `Pharmacy rejected the order (HTTP ${r.status}).`, warnings: j?.warnings, source: "greenstone" };
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
