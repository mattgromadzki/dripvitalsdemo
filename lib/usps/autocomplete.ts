"use client";
import type { AddressSuggestion } from "./types";

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
