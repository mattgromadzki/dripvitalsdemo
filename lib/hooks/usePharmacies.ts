"use client";

import { create } from "@/lib/hooks/zustand-shim";
import type { Pharmacy, PharmacyConnectionStatus } from "@/lib/types";
import { PHARMACIES as SEED } from "@/lib/data/pharmacies";
import { seedList } from "@/lib/config/runtime";

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
  pharmacies: seedList(SEED),
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
