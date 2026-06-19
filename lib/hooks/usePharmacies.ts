"use client";

import { create } from "@/lib/hooks/zustand-shim";
import type { Pharmacy, PharmacyConnectionStatus } from "@/lib/types";
import { PHARMACIES as SEED } from "@/lib/data/pharmacies";

interface PharmaciesState {
  pharmacies: Pharmacy[];
  add: (p: Omit<Pharmacy, "id">) => Pharmacy;
  update: (id: string, patch: Partial<Pharmacy>) => void;
  setStatus: (id: string, status: PharmacyConnectionStatus) => void;
  remove: (id: string) => void;
}

let nextSeq = SEED.length + 1;
function nextId(): string {
  return `PH-${String(nextSeq++).padStart(3, "0")}`;
}

export const usePharmacies = create<PharmaciesState>((set) => ({
  pharmacies: SEED,
  add: (input) => {
    const created: Pharmacy = { id: nextId(), ...input };
    set((s) => ({ pharmacies: [created, ...s.pharmacies] }));
    return created;
  },
  update: (id, patch) => {
    set((s) => ({
      pharmacies: s.pharmacies.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  },
  setStatus: (id, status) => {
    set((s) => ({
      pharmacies: s.pharmacies.map((p) => (p.id === id ? { ...p, status } : p)),
    }));
  },
  remove: (id) => {
    set((s) => ({ pharmacies: s.pharmacies.filter((p) => p.id !== id) }));
  },
}));

// Push the curated real pharmacy list to the server, overwriting any
// previously-seeded demo records. Use this once after deploying a seed change
// (pharmacies are server-persisted, so the server is authoritative after first
// load). Mirrors resetShopToDefaults / resetTreatmentsStoreToDefaults.
export async function resetPharmaciesToDefaults(): Promise<void> {
  nextSeq = SEED.length + 1;
  usePharmacies.setState({ pharmacies: SEED });
  if (typeof window !== "undefined") {
    try {
      await fetch(`/api/store/pharmacies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: SEED }),
      });
    } catch { /* ignore — local reset still applied */ }
  }
}
