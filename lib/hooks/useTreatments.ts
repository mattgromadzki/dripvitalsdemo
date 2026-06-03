"use client";

import { create } from "@/lib/hooks/zustand-shim";
import type { Treatment, IntakeForm, TreatmentStatus } from "@/lib/types";
import { TREATMENTS as TX_SEED, INTAKE_FORMS as FORM_SEED } from "@/lib/data/treatments";

interface TreatmentsState {
  treatments: Treatment[];
  forms: IntakeForm[];
  addTreatment: (t: Omit<Treatment, "id">) => Treatment;
  setTreatmentStatus: (id: string, status: TreatmentStatus) => void;
  toggleFeatured: (id: string) => void;
  removeTreatment: (id: string) => void;
  toggleFormStatus: (id: string) => void;
}

let txSeq = TX_SEED.length + 1;
function nextTxId(): string {
  return `TX-${String(txSeq++).padStart(3, "0")}`;
}

export const useTreatments = create<TreatmentsState>((set) => ({
  treatments: TX_SEED,
  forms: FORM_SEED,
  addTreatment: (input) => {
    const created: Treatment = { id: nextTxId(), ...input };
    set((s) => ({ treatments: [created, ...s.treatments] }));
    return created;
  },
  setTreatmentStatus: (id, status) => {
    set((s) => ({
      treatments: s.treatments.map((t) => (t.id === id ? { ...t, status } : t)),
    }));
  },
  toggleFeatured: (id) => {
    set((s) => ({
      treatments: s.treatments.map((t) => (t.id === id ? { ...t, featured: !t.featured } : t)),
    }));
  },
  removeTreatment: (id) => {
    set((s) => ({ treatments: s.treatments.filter((t) => t.id !== id) }));
  },
  toggleFormStatus: (id) => {
    set((s) => ({
      forms: s.forms.map((f) =>
        f.id === id
          ? { ...f, status: f.status === "active" ? "draft" : "active" }
          : f
      ),
    }));
  },
}));
