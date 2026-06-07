import type { ChargeInput, ChargeResult, RefundInput, RefundResult } from "./types";

/* ────────────────────────────────────────────────────────────────────────
   CorePay / NetValve payment driver (server-side). Built to the NetValve
   Merchant API (docs.netvalve.com).

   Env vars (set in Vercel — never commit secrets):
     PAYMENTS_PROVIDER = corepay
     COREPAY_CLIENT_ID = netvalve-client-id
     COREPAY_API_KEY   = netvalve api key
     COREPAY_MID_USD   = netvalveMidId for USD
     COREPAY_MID_EUR   = netvalveMidId for EUR (3DS)
     COREPAY_BASE_URL  = override base URL (defaults to sandbox/UAT below)

   Auth: headers `netvalve-api-key` + `netvalve-client-id`.
   Base URLs:  Sandbox  https://payment-api.uat.sandbox-netvalve.com
               Production https://api.netvalve.com
   Amounts are DECIMAL (12.99), not cents. Success = responseCodeType "APPROVED"
   (responseCode "GTW_1000"). Recurring uses /rebill against the original sale's
   transactionID (Recurring Option 1 — no token-vault enablement required).
   The first/initial card capture happens via NetValve's Hosted Payment Page or
   Hosted Payment Fields (PCI-safe, client-side) — we never take raw cards here.
   ──────────────────────────────────────────────────────────────────────── */

const BASE = (process.env.COREPAY_BASE_URL || "https://payment-api.uat.sandbox-netvalve.com").replace(/\/$/, "");
const CLIENT_ID = process.env.COREPAY_CLIENT_ID;
const API_KEY = process.env.COREPAY_API_KEY;
export const COREPAY_MID_USD = process.env.COREPAY_MID_USD;
export const COREPAY_MID_EUR = process.env.COREPAY_MID_EUR;

export const corepayConfigured = () => !!(CLIENT_ID && API_KEY);
export const corepayMidFor = (currency?: string) => ((currency || "USD").toUpperCase() === "EUR" ? COREPAY_MID_EUR : COREPAY_MID_USD);

function headers() {
  return { "netvalve-api-key": API_KEY!, "netvalve-client-id": CLIENT_ID!, "Content-Type": "application/json" };
}
const toDecimal = (cents: number) => Math.round(cents) / 100;

interface NvResp {
  responseCode?: string; responseCodeType?: string; responseMessage?: string;
  transactionID?: number; transactionId?: number; cardNumber?: string; cardType?: string; currency?: string;
}
const approved = (j: NvResp) => j?.responseCodeType === "APPROVED" || j?.responseCode === "GTW_1000";
function txId(j: NvResp) { const t = j?.transactionID ?? j?.transactionId; return t != null ? String(t) : undefined; }

/* Recurring charge — Rebill against a prior sale's transactionID (input.sourceId).
   This is the only server-side charge our app makes; the first payment that
   produces that transactionID is collected through NetValve's hosted flow. */
export async function corepayCharge(input: ChargeInput): Promise<ChargeResult> {
  try {
    const r = await fetch(`${BASE}/rebill`, {
      method: "POST", headers: headers(),
      body: JSON.stringify({ transactionID: Number(input.sourceId) || input.sourceId, amount: toDecimal(input.amountCents) }),
    });
    const j = (await r.json().catch(() => ({}))) as NvResp;
    if (!r.ok || !approved(j)) return { ok: false, error: j?.responseMessage || `CorePay declined (HTTP ${r.status}).`, status: j?.responseCodeType, provider: "corepay" };
    return { ok: true, paymentId: txId(j), status: j.responseCodeType, amountCents: input.amountCents, currency: input.currency || "USD", last4: (j.cardNumber || "").slice(-4), cardBrand: j.cardType, provider: "corepay" };
  } catch {
    return { ok: false, error: "Could not reach CorePay.", provider: "corepay" };
  }
}

/* Refund (full or partial) by original transactionID. */
export async function corepayRefund(input: RefundInput): Promise<RefundResult> {
  try {
    const body: Record<string, unknown> = { transactionID: Number(input.paymentId) || input.paymentId };
    if (input.amountCents) body.amount = toDecimal(input.amountCents); // omit for a full refund
    const r = await fetch(`${BASE}/refund`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
    const j = (await r.json().catch(() => ({}))) as NvResp;
    if (!r.ok || !approved(j)) return { ok: false, error: j?.responseMessage || `CorePay refund error (HTTP ${r.status}).`, provider: "corepay" };
    return { ok: true, refundId: txId(j), status: j.responseCodeType || "refunded", provider: "corepay" };
  } catch {
    return { ok: false, error: "Could not reach CorePay.", provider: "corepay" };
  }
}

/* ── Hosted Payment Page (HPP) ──────────────────────────────────────────────
   Creates a hosted order and returns NetValve's redirectUrl. The patient is sent
   there to enter card details on NetValve's PCI-compliant page (SAQ A). The
   resulting transactionID arrives via the success redirect + the webhook, and is
   stored as the subscription's token for future /rebill charges. */
export interface HppOrderArgs {
  amountCents: number;
  currency?: string;
  mode?: "SALE" | "AUTHORIZATION"; // AUTHORIZATION validates a card without capturing
  successUrl: string;
  cancelUrl: string;
  failedUrl: string;
  pendingUrl?: string;
  clientOrderId?: string;
  orderDesc?: string;
  descriptor?: string; // statement descriptor, <= 50 chars
  customer?: {
    email?: string; firstName?: string; lastName?: string; phone?: string;
    address?: string; city?: string; state?: string; zip?: string; countryCode?: string;
  };
}
export interface HppOrderResult {
  ok: boolean;
  redirectUrl?: string;
  orderId?: string;
  transactionID?: string;
  orderState?: string;
  error?: string;
}

export async function corepayCreateHppOrder(args: HppOrderArgs): Promise<HppOrderResult> {
  const currency = (args.currency || "USD").toUpperCase();
  const c = args.customer || {};
  const body: Record<string, unknown> = {
    mode: args.mode || "SALE",
    amount: toDecimal(args.amountCents),
    currency,
    netvalveMidId: corepayMidFor(currency),
    successUrl: args.successUrl,
    cancelUrl: args.cancelUrl,
    failedUrl: args.failedUrl,
    ...(args.pendingUrl ? { pendingUrl: args.pendingUrl } : {}),
    ...(args.clientOrderId ? { clientOrderId: args.clientOrderId.slice(0, 100) } : {}),
    ...(args.orderDesc ? { orderDesc: args.orderDesc } : {}),
    ...(args.descriptor ? { descriptor: args.descriptor.slice(0, 50) } : {}),
    customerDetails: {
      ...(c.email ? { customerEmail: c.email } : {}),
      ...(c.firstName ? { customerFirstName: c.firstName } : {}),
      ...(c.lastName ? { customerLastName: c.lastName } : {}),
      ...(c.phone ? { customerPhone: c.phone } : {}),
      ...(c.address ? { customerAddress: c.address } : {}),
      ...(c.city ? { customerCity: c.city } : {}),
      ...(c.state ? { customerState: c.state } : {}),
      ...(c.zip ? { customerZipCode: c.zip } : {}),
      customerCountryCode: (c.countryCode || "US").slice(0, 2),
    },
  };
  try {
    const r = await fetch(`${BASE}/hpp/order`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
    const j = (await r.json().catch(() => ({}))) as NvResp & { orderId?: number; orderState?: string; redirectUrl?: string };
    const redirectUrl = j.redirectUrl;
    if (!r.ok || !redirectUrl) {
      return { ok: false, error: j?.responseMessage || `Could not start hosted checkout (HTTP ${r.status}).` };
    }
    return {
      ok: true,
      redirectUrl,
      orderId: j.orderId != null ? String(j.orderId) : undefined,
      transactionID: txId(j),
      orderState: j.orderState,
    };
  } catch {
    return { ok: false, error: "Could not reach CorePay." };
  }
}

/* ── Inquiry (verify a transaction with the gateway) ────────────────────────
   Used to re-confirm a webhook's PURCHASED event against NetValve directly,
   so a spoofed or replayed callback can't create a subscription on its own.
   The OpenAPI spec defines GET /inquiry?transactionId=…; some docs show a POST
   variant, so we try GET and fall back to POST. */
export interface InquiryResult {
  ok: boolean;             // we received a parseable response from the gateway
  approved: boolean;       // the transaction is approved / paid
  orderState?: string;
  amount?: number;         // decimal
  currency?: string;
  cardNumber?: string;
  cardType?: string;
  transactionID?: string;
  responseCodeType?: string;
  error?: string;
}

export async function corepayInquiry(transactionId: string | number): Promise<InquiryResult> {
  const idNum = Number(transactionId);
  const id: string | number = Number.isFinite(idNum) ? idNum : transactionId;
  const call = (method: "GET" | "POST") =>
    method === "GET"
      ? fetch(`${BASE}/inquiry?transactionId=${encodeURIComponent(String(id))}`, { method: "GET", headers: headers() })
      : fetch(`${BASE}/inquiry`, { method: "POST", headers: headers(), body: JSON.stringify({ transactionId: id }) });
  try {
    let r = await call("GET");
    if ([400, 404, 405].includes(r.status)) {
      const alt = await call("POST");
      if (alt.ok) r = alt;
    }
    const j = (await r.json().catch(() => ({}))) as NvResp & { orderState?: string; amount?: number };
    if (!r.ok) return { ok: false, approved: false, error: j?.responseMessage || `Inquiry failed (HTTP ${r.status}).` };
    const approved = j.responseCodeType === "APPROVED" || j.responseCode === "GTW_1000" || j.orderState === "PAID";
    return {
      ok: true, approved, orderState: j.orderState, amount: j.amount, currency: j.currency,
      cardNumber: j.cardNumber, cardType: j.cardType, transactionID: txId(j), responseCodeType: j.responseCodeType,
    };
  } catch {
    return { ok: false, approved: false, error: "Could not reach CorePay." };
  }
}

/* ── Order lookup ───────────────────────────────────────────────────────────
   Reads back an order by our clientOrderId so we can deterministically capture
   the resulting transaction id + card after a hosted-page return (used by the
   "update card on file" flow, which can't rely on a charge webhook). */
interface OrderTxn { transactionId?: number; transactionType?: string; responseCode?: string; responseCodeType?: string; cardNumber?: string; cardType?: string; }
interface OrderResp { transactions?: OrderTxn[]; cardNumber?: string; cardType?: string; responseCodeType?: string; responseMessage?: string; }
export interface OrderLookup { ok: boolean; approved: boolean; transactionID?: string; last4?: string; cardType?: string; error?: string; }

export async function corepayGetOrder(clientOrderId: string): Promise<OrderLookup> {
  try {
    const r = await fetch(`${BASE}/order?clientOrderId=${encodeURIComponent(clientOrderId)}`, { method: "GET", headers: headers() });
    const j = (await r.json().catch(() => ({}))) as OrderResp;
    if (!r.ok) return { ok: false, approved: false, error: j?.responseMessage || `Order lookup failed (HTTP ${r.status}).` };
    const txns = Array.isArray(j.transactions) ? j.transactions : [];
    const appr = txns.find((t) => (t.responseCodeType === "APPROVED" || t.responseCode === "GTW_1000") && (t.transactionType === "SALE" || t.transactionType === "AUTHORIZATION"));
    const card = appr?.cardNumber || j.cardNumber || "";
    return {
      ok: true,
      approved: !!appr || j.responseCodeType === "APPROVED",
      transactionID: appr?.transactionId != null ? String(appr.transactionId) : undefined,
      last4: String(card).replace(/[^0-9*]/g, "").slice(-4),
      cardType: appr?.cardType || j.cardType,
    };
  } catch {
    return { ok: false, approved: false, error: "Could not reach CorePay." };
  }
}
