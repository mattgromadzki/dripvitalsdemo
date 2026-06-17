"use client";
import type { EmedOrderPayload, EmedSubmitResult, EmedOrderStatus, EmedRxStatus, EmedCancelResult } from "./types";

export async function submitOrder(payload: EmedOrderPayload): Promise<EmedSubmitResult> {
  try {
    const r = await fetch("/api/pharmacy/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return await r.json();
  } catch { return { ok: false, error: "Network error.", source: "emed" }; }
}
export async function getOrderStatus(id: number | string): Promise<EmedOrderStatus> {
  try { return await (await fetch(`/api/pharmacy/order/${id}`)).json(); }
  catch { return { ok: false, error: "Network error.", source: "emed" }; }
}
export async function getRxStatus(id: number | string): Promise<EmedRxStatus> {
  try { return await (await fetch(`/api/pharmacy/rx/${id}`)).json(); }
  catch { return { ok: false, error: "Network error.", source: "emed" }; }
}
export async function cancelOrder(id: number | string): Promise<EmedCancelResult> {
  try { return await (await fetch(`/api/pharmacy/order/${id}`, { method: "DELETE" })).json(); }
  catch { return { ok: false, error: "Network error.", source: "emed" }; }
}

// ── Life File (Hallandale) ────────────────────────────────────────────────
import type { LFOrderBody, LFResult } from "./lifefileTypes";
export async function submitLifeFile(body: LFOrderBody): Promise<LFResult> {
  try {
    const r = await fetch("/api/pharmacy/lifefile/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return await r.json();
  } catch { return { ok: false, error: "Network error.", source: "lifefile" }; }
}
export async function setLifeFileStatus(id: number | string, statusId: string): Promise<LFResult> {
  try {
    const r = await fetch(`/api/pharmacy/lifefile/order/${id}/status`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statusId }) });
    return await r.json();
  } catch { return { ok: false, error: "Network error.", source: "lifefile" }; }
}

// ── GreenstoneRX (5Axis) ──────────────────────────────────────────────────
import type { GsOrderInput, GsSubmitResult, GsStatusResult } from "./greenstoneTypes";
export async function submitGreenstone(input: GsOrderInput): Promise<GsSubmitResult> {
  try {
    const r = await fetch("/api/pharmacy/greenstone/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    return await r.json();
  } catch { return { ok: false, error: "Network error.", source: "greenstone" }; }
}
export async function getGreenstoneStatus(id: number | string): Promise<GsStatusResult> {
  try { return await (await fetch(`/api/pharmacy/greenstone/order/${id}`)).json(); }
  catch { return { ok: false, error: "Network error.", source: "greenstone" }; }
}
