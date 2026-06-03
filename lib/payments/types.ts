// Provider-agnostic payment types. Swap providers without touching callers.
export interface ChargeInput {
  sourceId: string;        // card token/nonce from the client SDK (or mock)
  amountCents: number;
  currency?: string;       // default USD
  note?: string;
  referenceId?: string;    // e.g. our order id
}
export interface ChargeResult {
  ok: boolean;
  paymentId?: string;
  status?: string;         // COMPLETED, PENDING, FAILED…
  amountCents?: number;
  currency?: string;
  cardBrand?: string;
  last4?: string;
  receiptUrl?: string;
  error?: string;
  provider: string;        // "square" | "mock" | …
}
export interface PaymentsPublicConfig {
  provider: string;
  ready: boolean;          // true when the provider can take live cards
  square?: { appId?: string; locationId?: string; env: "sandbox" | "production" };
}
