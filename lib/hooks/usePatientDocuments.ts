"use client";

import { create } from "@/lib/hooks/zustand-shim";
import type { PatientDocument } from "@/lib/types";

interface PatientDocumentsState {
  documents: PatientDocument[];
  add: (doc: Omit<PatientDocument, "id">) => PatientDocument;
  update: (id: string, patch: Partial<PatientDocument>) => void;
  remove: (id: string) => void;
  // Stamps the approving provider onto a patient's visit packet (record + intake).
  stampVisitApproval: (opts: { patientId: string; visitId?: string; provider: string; decision?: string }) => void;
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
  update: (id, patch) => {
    set((s) => ({ documents: s.documents.map((d) => (d.id === id ? { ...d, ...patch } : d)) }));
  },
  remove: (id) => {
    set((s) => ({ documents: s.documents.filter((d) => d.id !== id) }));
  },
  stampVisitApproval: ({ patientId, visitId, provider, decision }) => {
    set((s) => {
      // If a specific visit packet matches by visitId, only stamp that one;
      // otherwise stamp the patient's visit packet(s) (normally just one).
      const hasVisitMatch = visitId
        ? s.documents.some((d) => d.category === "visit" && d.patientId === patientId && d.visitPayload?.visitId === visitId)
        : false;
      return {
        documents: s.documents.map((d) => {
          if (d.category !== "visit" || d.patientId !== patientId || !d.visitPayload) return d;
          if (hasVisitMatch && d.visitPayload.visitId !== visitId) return d;
          return {
            ...d,
            signedBy: d.signedBy,
            visitPayload: {
              ...d.visitPayload,
              provider,
              screening: { ...d.visitPayload.screening, decision: decision || "Approved" },
            },
          };
        }),
      };
    });
  },
  getForPatient: (patientId) => get().documents.filter((d) => d.patientId === patientId),
}));
