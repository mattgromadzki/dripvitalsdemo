"use client";

import { create } from "@/lib/hooks/zustand-shim";
import type { PatientDocument } from "@/lib/types";

interface PatientDocumentsState {
  documents: PatientDocument[];
  add: (doc: Omit<PatientDocument, "id">) => PatientDocument;
  remove: (id: string) => void;
  getForPatient: (patientId: string) => PatientDocument[];
}

let nextSeq = 1;
function nextId(): string {
  return `PDOC-${String(nextSeq++).padStart(5, "0")}`;
}

export const usePatientDocuments = create<PatientDocumentsState>((set, get) => ({
  documents: [],
  add: (input) => {
    const created: PatientDocument = { id: nextId(), ...input };
    set((s) => ({ documents: [created, ...s.documents] }));
    return created;
  },
  remove: (id) => {
    set((s) => ({ documents: s.documents.filter((d) => d.id !== id) }));
  },
  getForPatient: (patientId) => get().documents.filter((d) => d.patientId === patientId),
}));
