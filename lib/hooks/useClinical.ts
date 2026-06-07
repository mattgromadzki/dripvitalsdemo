"use client";
import { create } from "@/lib/hooks/zustand-shim";
import type { Patient } from "@/lib/types";
import {
  seedChart, EMPTY_CHART,
  type ClinicalChart, type Problem, type Allergy, type MedicationEntry, type VitalEntry,
} from "@/lib/clinical/chartTypes";

/** Per-patient structured clinical data, persisted to the server (store:clinical). */
interface State {
  charts: Record<string, ClinicalChart>;
  ensureSeeded: (pid: string, patient: Patient) => void;
  setNkda: (pid: string, v: boolean) => void;
  addProblem: (pid: string, p: Problem) => void;
  updateProblem: (pid: string, id: string, patch: Partial<Problem>) => void;
  removeProblem: (pid: string, id: string) => void;
  addAllergy: (pid: string, a: Allergy) => void;
  updateAllergy: (pid: string, id: string, patch: Partial<Allergy>) => void;
  removeAllergy: (pid: string, id: string) => void;
  addMed: (pid: string, m: MedicationEntry) => void;
  updateMed: (pid: string, id: string, patch: Partial<MedicationEntry>) => void;
  removeMed: (pid: string, id: string) => void;
  addVital: (pid: string, v: VitalEntry) => void;
  removeVital: (pid: string, id: string) => void;
}

const chartOf = (charts: Record<string, ClinicalChart>, pid: string): ClinicalChart => charts[pid] ?? EMPTY_CHART;
const put = (charts: Record<string, ClinicalChart>, pid: string, next: ClinicalChart) => ({ charts: { ...charts, [pid]: next } });

export const useClinical = create<State>((set) => ({
  charts: {},

  ensureSeeded: (pid, patient) => set((s) => (s.charts[pid] ? {} : put(s.charts, pid, seedChart(patient)))),

  setNkda: (pid, v) => set((s) => { const c = chartOf(s.charts, pid); return put(s.charts, pid, { ...c, nkda: v, allergies: v ? [] : c.allergies }); }),

  addProblem: (pid, p) => set((s) => { const c = chartOf(s.charts, pid); return put(s.charts, pid, { ...c, problems: [p, ...c.problems] }); }),
  updateProblem: (pid, id, patch) => set((s) => { const c = chartOf(s.charts, pid); return put(s.charts, pid, { ...c, problems: c.problems.map((x) => x.id === id ? { ...x, ...patch } : x) }); }),
  removeProblem: (pid, id) => set((s) => { const c = chartOf(s.charts, pid); return put(s.charts, pid, { ...c, problems: c.problems.filter((x) => x.id !== id) }); }),

  addAllergy: (pid, a) => set((s) => { const c = chartOf(s.charts, pid); return put(s.charts, pid, { ...c, nkda: false, allergies: [a, ...c.allergies] }); }),
  updateAllergy: (pid, id, patch) => set((s) => { const c = chartOf(s.charts, pid); return put(s.charts, pid, { ...c, allergies: c.allergies.map((x) => x.id === id ? { ...x, ...patch } : x) }); }),
  removeAllergy: (pid, id) => set((s) => { const c = chartOf(s.charts, pid); return put(s.charts, pid, { ...c, allergies: c.allergies.filter((x) => x.id !== id) }); }),

  addMed: (pid, m) => set((s) => { const c = chartOf(s.charts, pid); return put(s.charts, pid, { ...c, meds: [m, ...c.meds] }); }),
  updateMed: (pid, id, patch) => set((s) => { const c = chartOf(s.charts, pid); return put(s.charts, pid, { ...c, meds: c.meds.map((x) => x.id === id ? { ...x, ...patch } : x) }); }),
  removeMed: (pid, id) => set((s) => { const c = chartOf(s.charts, pid); return put(s.charts, pid, { ...c, meds: c.meds.filter((x) => x.id !== id) }); }),

  addVital: (pid, v) => set((s) => { const c = chartOf(s.charts, pid); return put(s.charts, pid, { ...c, vitals: [v, ...c.vitals] }); }),
  removeVital: (pid, id) => set((s) => { const c = chartOf(s.charts, pid); return put(s.charts, pid, { ...c, vitals: c.vitals.filter((x) => x.id !== id) }); }),
}));
