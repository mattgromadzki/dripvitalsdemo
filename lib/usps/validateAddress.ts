"use client";
import type { UspsValidateInput, UspsValidateResult } from "./types";

// Client helper: posts to our own server route (which holds the USPS secret).
export async function validateAddress(input: UspsValidateInput): Promise<UspsValidateResult> {
  try {
    const r = await fetch("/api/validate-address", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return (await r.json()) as UspsValidateResult;
  } catch {
    return { status: "error", dpv: null, address: null, corrections: [], warnings: [], vacant: false, changed: false, message: "Could not reach the address service.", source: "mock" };
  }
}
