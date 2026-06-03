import type { ChargeInput, ChargeResult, PaymentsPublicConfig } from "./types";
import { squareCharge, squareConfigured, SQUARE_APP_ID, SQUARE_LOCATION_ID, SQUARE_ENV } from "./square";
import { corepayCharge, corepayConfigured } from "./corepay";

/* Provider selection via PAYMENTS_PROVIDER. Drivers: square, corepay. Add more
   by writing a driver + a branch here — callers never change. No creds -> mock. */
const PROVIDER = (process.env.PAYMENTS_PROVIDER || "square").toLowerCase();

function mockCharge(input: ChargeInput): ChargeResult {
  if (/decline/i.test(input.sourceId)) return { ok: false, error: "Card declined (mock).", provider: "mock" };
  const last4 = (Math.abs([...input.sourceId].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % 10000).toString().padStart(4, "0");
  return { ok: true, paymentId: "mock_pay_" + Date.now().toString(36), status: "COMPLETED", amountCents: input.amountCents, currency: input.currency || "USD", cardBrand: "VISA", last4, provider: "mock" };
}

export async function charge(input: ChargeInput): Promise<ChargeResult> {
  if (PROVIDER === "corepay" && corepayConfigured()) return corepayCharge(input);
  if (PROVIDER === "square" && squareConfigured()) return squareCharge(input);
  return mockCharge(input);
}

export function publicConfig(): PaymentsPublicConfig {
  if (PROVIDER === "square" && squareConfigured()) {
    return { provider: "square", ready: !!SQUARE_APP_ID, square: { appId: SQUARE_APP_ID, locationId: SQUARE_LOCATION_ID, env: SQUARE_ENV } };
  }
  if (PROVIDER === "corepay" && corepayConfigured()) {
    // ready stays false until NetValve's client tokenization / 3DS flow is confirmed.
    return { provider: "corepay", ready: false };
  }
  return { provider: PROVIDER, ready: false };
}
