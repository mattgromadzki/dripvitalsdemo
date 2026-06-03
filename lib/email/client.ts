"use client";
import type { SendEmailInput, SendEmailResult } from "./types";
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  try {
    const r = await fetch("/api/email/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    return await r.json();
  } catch { return { ok: false, error: "Network error.", provider: "unknown" }; }
}
