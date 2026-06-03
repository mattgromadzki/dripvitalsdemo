"use client";
import type { ChargeInput, ChargeResult, PaymentsPublicConfig } from "./types";

export async function getPaymentsConfig(): Promise<PaymentsPublicConfig> {
  try { return await (await fetch("/api/payments/config")).json(); }
  catch { return { provider: "mock", ready: false }; }
}
export async function charge(input: ChargeInput): Promise<ChargeResult> {
  try {
    const r = await fetch("/api/payments/charge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    return await r.json();
  } catch { return { ok: false, error: "Network error.", provider: "unknown" }; }
}
