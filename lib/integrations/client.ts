"use client";
export interface IntegrationStatus {
  email: { provider: string; configured: boolean; keyMask: string | null; from: string | null };
  sms: { provider: string; configured: boolean; sidMask: string | null; tokenSet: boolean; from: string | null };
}
export async function getIntegrations(): Promise<IntegrationStatus | null> {
  try { return await (await fetch("/api/settings/integrations")).json(); } catch { return null; }
}
export async function saveIntegrations(patch: object): Promise<IntegrationStatus | null> {
  try { const r = await fetch("/api/settings/integrations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }); return (await r.json())?.status ?? null; } catch { return null; }
}
export async function testIntegration(which: "email" | "sms"): Promise<{ ok: boolean; message?: string; error?: string }> {
  try { return await (await fetch("/api/settings/integrations/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ which }) })).json(); } catch { return { ok: false, error: "Network error." }; }
}
