"use client";

import { create } from "@/lib/hooks/zustand-shim";
import type { Patient } from "@/lib/types";
import { PATIENTS as SEED } from "@/lib/data/patients";
import { seedList } from "@/lib/config/runtime";

interface PatientsState {
  patients: Patient[];
  nextNumericId: number;
  add: (p: Omit<Patient, "id">) => Patient;
  update: (id: string, patch: Partial<Patient>) => void;
  upsert: (p: Patient) => void;
  remove: (id: string) => void;
}

function makeId(n: number): string {
  return "PT-" + String(n).padStart(4, "0");
}

// New patient numbering starts here (PT-1001, PT-1002, …). Existing lower-
// numbered records are left as-is; the next NEW id is always at least this.
const ID_FLOOR = 1001;

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
  patients: seedList(SEED),
  nextNumericId: Math.max(ID_FLOOR, highestNumericId(SEED) + 1),
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
  upsert: (p) => {
    set((s) => {
      const exists = s.patients.some((x) => x.id === p.id);
      const patients = exists
        ? s.patients.map((x) => (x.id === p.id ? { ...x, ...p } : x))
        : [p, ...s.patients];
      const n = parseInt((p.id.match(/PT-(\d+)/) || [])[1] || "0", 10);
      return { patients, nextNumericId: Math.max(s.nextNumericId, n + 1, ID_FLOOR) };
    });
  },
  remove: (id) => {
    set((s) => ({ patients: s.patients.filter((p) => p.id !== id) }));
  },
}));

/** Non-hook accessor for components that just need to look up a patient by id once. */
export function getPatientById(id: string): Patient | undefined {
  return usePatients.getState().patients.find((p) => p.id === id);
}
