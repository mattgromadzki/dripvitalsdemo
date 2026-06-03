"use client";
import { create } from "@/lib/hooks/zustand-shim";
import type { SideEffectReport, ReportStatus } from "@/lib/adverse/types";
import { escalationReason } from "@/lib/adverse/symptoms";
import type { Severity } from "@/lib/adverse/symptoms";

const past = (h: number) => { const d = new Date(); d.setHours(d.getHours() - h); return d.toISOString(); };

const SEED: SideEffectReport[] = [
  { id: "AE-6001", patientName: "Sarah Lin", med: "Compounded Tirzepatide", symptom: "Severe abdominal pain", severity: "severe", onset: "Yesterday", note: "Sharp upper-abdomen pain radiating to back since last night.", status: "open", escalated: true, reportedAt: past(3) },
  { id: "AE-6002", patientName: "Michael Gromadzki", med: "Compounded Semaglutide", symptom: "Nausea", severity: "moderate", onset: "2 days", note: "Queasy in the mornings, manageable.", status: "open", escalated: false, reportedAt: past(20) },
  { id: "AE-6003", patientName: "James Carter", med: "Compounded Semaglutide", symptom: "Constipation", severity: "mild", onset: "This week", note: "", status: "reviewing", escalated: false, reportedAt: past(40), providerNote: "Advised fiber + fluids.", decidedBy: "Dr. Rivera", decidedAt: past(30) },
  { id: "AE-6004", patientName: "Maria Gomez", med: "Compounded Tirzepatide", symptom: "Allergic reaction / rash", severity: "moderate", onset: "Today", note: "Itchy rash near injection site spreading.", status: "open", escalated: true, reportedAt: past(2) },
  { id: "AE-6005", patientName: "Derek Olsen", med: "Compounded Semaglutide", symptom: "Headache", severity: "mild", onset: "3 days", note: "", status: "resolved", escalated: false, reportedAt: past(96), providerNote: "Resolved with hydration.", decidedBy: "Dr. Rivera", decidedAt: past(70) },
];

interface State {
  reports: SideEffectReport[];
  seq: number;
  add: (r: { patientName: string; patientId?: string; med: string; symptom: string; severity: Severity; onset: string; note: string }) => void;
  setStatus: (id: string, status: ReportStatus, note?: string) => void;
  toggleEscalate: (id: string) => void;
}
export const useAdverse = create<State>((set) => ({
  reports: SEED,
  seq: 6006,
  add: (r) => set((s) => ({
    reports: [{ ...r, id: "AE-" + s.seq, status: "open", escalated: !!escalationReason(r.symptom, r.severity), reportedAt: new Date().toISOString() }, ...s.reports],
    seq: s.seq + 1,
  })),
  setStatus: (id, status, note) => set((s) => ({ reports: s.reports.map((x) => x.id === id ? { ...x, status, providerNote: note ?? x.providerNote, decidedBy: "Dr. Rivera", decidedAt: new Date().toISOString() } : x) })),
  toggleEscalate: (id) => set((s) => ({ reports: s.reports.map((x) => x.id === id ? { ...x, escalated: !x.escalated } : x) })),
}));
