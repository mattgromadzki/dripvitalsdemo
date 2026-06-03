"use client";
// System-wide internal Rx ID. Numeric, starts at 10001, always increasing.
// Persisted to localStorage so the sequence keeps climbing across reloads.
const KEY = "dv_rx_counter_v1";
const START = 10001;

export function nextRxId(): number {
  if (typeof window === "undefined") return START;
  let n = START;
  try { const r = window.localStorage.getItem(KEY); if (r) n = parseInt(r, 10) || START; } catch { /* ignore */ }
  try { window.localStorage.setItem(KEY, String(n + 1)); } catch { /* ignore */ }
  return n;
}
export function peekRxId(): number {
  if (typeof window === "undefined") return START;
  try { const r = window.localStorage.getItem(KEY); return r ? (parseInt(r, 10) || START) : START; } catch { return START; }
}
