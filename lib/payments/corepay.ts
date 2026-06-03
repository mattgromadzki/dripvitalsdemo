import type { ChargeInput, ChargeResult } from "./types";

/* ────────────────────────────────────────────────────────────────────────
   Corepay / NetValve payment driver (server-side).

   Credentials (set in .env.local):
     COREPAY_CLIENT_ID = netvalve-client-id
     COREPAY_API_KEY   = api-key
     COREPAY_SITE_ID   = siteId
     COREPAY_MID_USD   = netvalveMidId for USD
     COREPAY_MID_EUR   = netvalveMidId for EUR (3DS)
     COREPAY_BASE_URL  = (from NetValve docs — PLACEHOLDER below)

   ⚠ The endpoint path and request/response BODY below are PLACEHOLDERS. They
   need to be confirmed against the NetValve/Corepay API documentation before
   live use. The MID is selected by currency (EUR -> 3DS MID, else USD MID).
   Until the spec is confirmed, publicConfig() reports ready:false so the UI
   stays in mock mode (we also don't yet know NetValve's client-side card
   tokenization / 3DS challenge flow).
   ──────────────────────────────────────────────────────────────────────── */

const BASE = process.env.COREPAY_BASE_URL || "https://api.netvalve.com"; // TODO confirm
const CLIENT_ID = process.env.COREPAY_CLIENT_ID;
const API_KEY = process.env.COREPAY_API_KEY;
const SITE_ID = process.env.COREPAY_SITE_ID;
const MID_USD = process.env.COREPAY_MID_USD;
const MID_EUR = process.env.COREPAY_MID_EUR;

export const corepayConfigured = () => !!(CLIENT_ID && API_KEY && SITE_ID);

function midFor(currency?: string): string | undefined {
  return (currency || "USD").toUpperCase() === "EUR" ? MID_EUR : MID_USD;
}

export async function corepayCharge(input: ChargeInput): Promise<ChargeResult> {
  try {
    const r = await fetch(`${BASE}/v1/transactions`, { // TODO confirm endpoint
      method: "POST",
      headers: {
        "netvalve-client-id": CLIENT_ID!,
        "api-key": API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        siteId: SITE_ID,
        midId: midFor(input.currency),
        amount: input.amountCents,        // TODO confirm cents vs decimal
        currency: input.currency || "USD",
        token: input.sourceId,            // TODO confirm field name / tokenization
        reference: input.referenceId,
        description: input.note,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.error) return { ok: false, error: j?.message || `Corepay error (HTTP ${r.status}).`, provider: "corepay" };
    return { ok: true, paymentId: j.id ?? j.transactionId, status: j.status, amountCents: input.amountCents, currency: input.currency || "USD", provider: "corepay" };
  } catch {
    return { ok: false, error: "Could not reach Corepay.", provider: "corepay" };
  }
}
