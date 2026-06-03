"use client";
import type { SendSmsInput, SendSmsResult } from "./types";
export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  try {
    const r = await fetch("/api/sms/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    return await r.json();
  } catch { return { ok: false, error: "Network error.", provider: "unknown" }; }
}
