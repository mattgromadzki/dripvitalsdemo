"use client";
import type { AddressSuggestion } from "./types";

// Defensive: keep only the street line (drop anything after a comma and any
// trailing ZIP), so the street field never contains city/state/ZIP.
export function cleanStreet(s: string): string {
  return (s || "").split(",")[0].replace(/\s+\d{5}(-\d{4})?\s*$/, "").trim();
}

// Reports whether real address lookup (Smarty) is connected, or the app is
// running on the built-in demo generator. Used by the address-field badge.
export async function fetchAddressMode(): Promise<"smarty" | "mock"> {
  try {
    const r = await fetch("/api/address-autocomplete?q=");
    const j = await r.json();
    return j?.source === "smarty" ? "smarty" : "mock";
  } catch {
    return "mock";
  }
}

// Client helper: fetch type-ahead suggestions from our own server route
// (which holds the provider key). Returns [] for very short queries.
export async function fetchSuggestions(query: string, state?: string): Promise<AddressSuggestion[]> {
  if (query.trim().length < 3) return [];
  try {
    const qs = new URLSearchParams({ q: query });
    if (state) qs.set("state", state);
    const r = await fetch(`/api/address-autocomplete?${qs.toString()}`);
    const j = await r.json();
    return Array.isArray(j.suggestions) ? j.suggestions : [];
  } catch {
    return [];
  }
}
