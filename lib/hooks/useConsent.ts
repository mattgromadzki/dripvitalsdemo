"use client";
import { create } from "@/lib/hooks/zustand-shim";
import type { ConsentRecord, ConsentStatus } from "@/lib/consent/types";
import { getAgreement } from "@/lib/consent/docs";

const past = (d: number) => { const x = new Date(); x.setDate(x.getDate() - d); return x.toISOString(); };
const R = (id: string, pid: string, pname: string, docId: string, status: ConsentStatus, signedDaysAgo?: number): ConsentRecord => {
  const a = getAgreement(docId)!;
  return { id, patientId: pid, patientName: pname, docId, docName: a.name, version: a.version, status, method: status === "signed" ? "E-signature" : undefined, sentAt: past((signedDaysAgo ?? 5) + 1), signedAt: status === "signed" ? past(signedDaysAgo ?? 5) : undefined };
};

const SEED: ConsentRecord[] = [
  R("CN-1", "PT-1042", "Sarah Lin", "telehealth", "signed", 30), R("CN-2", "PT-1042", "Sarah Lin", "hipaa", "signed", 30), R("CN-3", "PT-1042", "Sarah Lin", "treatment", "signed", 30), R("CN-4", "PT-1042", "Sarah Lin", "autorefill", "pending"),
  R("CN-5", "PT-1039", "Michael Gromadzki", "telehealth", "signed", 60), R("CN-6", "PT-1039", "Michael Gromadzki", "hipaa", "signed", 60), R("CN-7", "PT-1039", "Michael Gromadzki", "treatment", "pending"),
  R("CN-8", "PT-1051", "Maria Gomez", "telehealth", "signed", 10), R("CN-9", "PT-1051", "Maria Gomez", "id", "declined"),
];

interface State {
  records: ConsentRecord[];
  seq: number;
  request: (patientId: string, patientName: string, docId: string) => void;
  sign: (id: string) => void;
  decline: (id: string) => void;
}
export const useConsent = create<State>((set) => ({
  records: SEED,
  seq: 10,
  request: (patientId, patientName, docId) => set((s) => {
    if (s.records.some((r) => r.patientId === patientId && r.docId === docId && (r.status === "signed" || r.status === "pending"))) return {};
    const a = getAgreement(docId); if (!a) return {};
    return { records: [{ id: "CN-" + s.seq, patientId, patientName, docId, docName: a.name, version: a.version, status: "pending", sentAt: new Date().toISOString() }, ...s.records], seq: s.seq + 1 };
  }),
  sign: (id) => set((s) => ({ records: s.records.map((r) => r.id === id ? { ...r, status: "signed", method: "E-signature", signedAt: new Date().toISOString() } : r) })),
  decline: (id) => set((s) => ({ records: s.records.map((r) => r.id === id ? { ...r, status: "declined" } : r) })),
}));
