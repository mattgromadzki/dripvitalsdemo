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
