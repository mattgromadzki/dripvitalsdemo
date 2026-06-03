"use client";
import type { HealthItem } from "./health";
export async function getHealth(): Promise<HealthItem[]> {
  try { return (await (await fetch("/api/integrations/health")).json())?.items ?? []; } catch { return []; }
}
export async function testConnector(id: string): Promise<{ ok: boolean; message?: string; error?: string }> {
  try { return await (await fetch("/api/integrations/health", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })).json(); } catch { return { ok: false, error: "Network error." }; }
}
