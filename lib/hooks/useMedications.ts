"use client";

import { create } from "@/lib/hooks/zustand-shim";
import type { Medication } from "@/lib/types";
import { MEDICATIONS_SEED as SEED } from "@/lib/data/medications";
import { seedList } from "@/lib/config/runtime";

interface MedicationsState {
  meds: Medication[];
  nextId: number;
  add: (m: Omit<Medication, "id">) => Medication;
  update: (id: string, patch: Partial<Medication>) => void;
  remove: (id: string) => void;
}

function makeId(n: number): string {
  return "MED-" + String(n).padStart(3, "0");
}
function highest(meds: Medication[]): number {
  let max = 0;
  for (const m of meds) {
    const x = m.id.match(/MED-(\d+)/);
    if (x) max = Math.max(max, parseInt(x[1], 10));
  }
  return max;
}

export const useMedications = create<MedicationsState>((set) => ({
  meds: seedList(SEED),
  nextId: highest(SEED) + 1,
  add: (input) => {
    let created: Medication = { id: "MED-999", ...input };
    set((s) => {
      created = { id: makeId(s.nextId), ...input };
      return { meds: [created, ...s.meds], nextId: s.nextId + 1 };
    });
    return created;
  },
  update: (id, patch) =>
    set((s) => ({ meds: s.meds.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
  remove: (id) => set((s) => ({ meds: s.meds.filter((m) => m.id !== id) })),
}));
