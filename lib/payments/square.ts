import type { ChargeInput, ChargeResult } from "./types";

// Square Payments driver (server-side). See provider.ts for selection/mock.
const ENV = (process.env.SQUARE_ENV || "sandbox") as "sandbox" | "production";
const TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const LOCATION = process.env.SQUARE_LOCATION_ID;
export const SQUARE_APP_ID = process.env.SQUARE_APP_ID;
export const SQUARE_LOCATION_ID = LOCATION;
export const SQUARE_ENV = ENV;
const API = ENV === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";

export const squareConfigured = () => !!(TOKEN && LOCATION);

export async function squareCharge(input: ChargeInput): Promise<ChargeResult> {
  try {
    const r = await fetch(`${API}/v2/payments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Square-Version": "2024-10-17", "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotency_key: (globalThis.crypto?.randomUUID?.() ?? String(Date.now() + Math.random())),
        source_id: input.sourceId,
        location_id: LOCATION,
        amount_money: { amount: input.amountCents, currency: input.currency || "USD" },
        note: input.note,
        reference_id: input.referenceId,
      }),
    });
    const j = await r.json();
    if (!r.ok || j?.errors) {
      const msg = j?.errors?.[0]?.detail || `Square error (HTTP ${r.status}).`;
      return { ok: false, error: msg, provider: "square" };
    }
    const p = j.payment || {};
    const card = p.card_details?.card || {};
    return {
      ok: true, paymentId: p.id, status: p.status, amountCents: p.amount_money?.amount, currency: p.amount_money?.currency,
      cardBrand: card.card_brand, last4: card.last_4, receiptUrl: p.receipt_url, provider: "square",
    };
  } catch {
    return { ok: false, error: "Could not reach Square.", provider: "square" };
  }
}
