"use client";

import { create } from "@/lib/hooks/zustand-shim";
import type { Patient } from "@/lib/types";
import { PATIENTS as SEED } from "@/lib/data/patients";

interface PatientsState {
  patients: Patient[];
  nextNumericId: number;
  add: (p: Omit<Patient, "id">) => Patient;
  update: (id: string, patch: Partial<Patient>) => void;
  remove: (id: string) => void;
}

function makeId(n: number): string {
  return "PT-" + String(n).padStart(4, "0");
}

function highestNumericId(patients: Patient[]): number {
  let max = 0;
  for (const p of patients) {
    const m = p.id.match(/PT-(\d+)/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return max;
}

export const usePatients = create<PatientsState>((set) => ({
  patients: SEED,
  nextNumericId: highestNumericId(SEED) + 1,
  add: (input) => {
    let created: Patient = { id: "PT-9999", ...input };
    set((s) => {
      const newId = makeId(s.nextNumericId);
      created = { id: newId, ...input };
      return {
        patients: [created, ...s.patients],
        nextNumericId: s.nextNumericId + 1,
      };
    });
    return created;
  },
  update: (id, patch) => {
    set((s) => ({
      patients: s.patients.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  },
  remove: (id) => {
    set((s) => ({ patients: s.patients.filter((p) => p.id !== id) }));
  },
}));

/** Non-hook accessor for components that just need to look up a patient by id once. */
export function getPatientById(id: string): Patient | undefined {
  return usePatients.getState().patients.find((p) => p.id === id);
}
