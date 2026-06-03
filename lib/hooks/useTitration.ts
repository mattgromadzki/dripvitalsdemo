"use client";
import { create } from "@/lib/hooks/zustand-shim";
import type { PatientTitration } from "@/lib/titration/types";
import { getProtocol } from "@/lib/titration/protocols";

const past = (days: number) => { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString(); };

const SEED: PatientTitration[] = [
  { id: "TT-1", patientName: "Michael Gromadzki", protocolId: "sema", med: "Compounded Semaglutide", stepIndex: 1, startedAt: past(40), currentStepStart: past(30), status: "titrating" }, // due to advance (>28d)
  { id: "TT-2", patientName: "Sarah Lin", protocolId: "tirz", med: "Compounded Tirzepatide", stepIndex: 0, startedAt: past(10), currentStepStart: past(10), status: "titrating" },
  { id: "TT-3", patientName: "James Carter", protocolId: "sema", med: "Compounded Semaglutide", stepIndex: 4, startedAt: past(140), currentStepStart: past(20), status: "maintenance" },
  { id: "TT-4", patientName: "Maria Gomez", protocolId: "tirz", med: "Compounded Tirzepatide", stepIndex: 2, startedAt: past(70), currentStepStart: past(15), status: "hold" },
];

interface State {
  plans: PatientTitration[];
  seq: number;
  advance: (id: string) => void;
  hold: (id: string) => void;
  resume: (id: string) => void;
  assign: (patientName: string, protocolId: string, patientId?: string) => void;
}
export const useTitration = create<State>((set) => ({
  plans: SEED,
  seq: 5,
  advance: (id) => set((s) => ({
    plans: s.plans.map((p) => {
      if (p.id !== id) return p;
      const proto = getProtocol(p.protocolId); if (!proto) return p;
      const next = Math.min(p.stepIndex + 1, proto.steps.length - 1);
      const atMaint = !!proto.steps[next]?.maintenance;
      return { ...p, stepIndex: next, currentStepStart: new Date().toISOString(), status: atMaint ? "maintenance" : "titrating" };
    }),
  })),
  hold: (id) => set((s) => ({ plans: s.plans.map((p) => p.id === id ? { ...p, status: "hold" } : p) })),
  resume: (id) => set((s) => ({ plans: s.plans.map((p) => { if (p.id !== id) return p; const proto = getProtocol(p.protocolId); const maint = !!proto?.steps[p.stepIndex]?.maintenance; return { ...p, status: maint ? "maintenance" : "titrating" }; }) })),
  assign: (patientName, protocolId, patientId) => set((s) => {
    const proto = getProtocol(protocolId);
    return { plans: [{ id: "TT-" + s.seq, patientName, patientId, protocolId, med: proto?.med || "", stepIndex: 0, startedAt: new Date().toISOString(), currentStepStart: new Date().toISOString(), status: "titrating" }, ...s.plans], seq: s.seq + 1 };
  }),
}));
