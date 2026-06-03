"use client";
import { create } from "@/lib/hooks/zustand-shim";
import type { LabOrder, LabStatus } from "@/lib/labs/types";
import { getPanel, generateResults } from "@/lib/labs/panels";

const past = (d: number) => { const x = new Date(); x.setDate(x.getDate() - d); return x.toISOString(); };

const SEED: LabOrder[] = [
  { id: "LAB-9001", patientName: "Michael Gromadzki", patientId: "PT-1039", panelId: "a1c", panelName: "Hemoglobin A1C", status: "resulted", orderedAt: past(6), resultedAt: past(1), provider: "Dr. Rivera", results: [{ analyte: "HbA1c", unit: "%", range: "4.0–5.6", value: 6.2, flag: "high" }] },
  { id: "LAB-9002", patientName: "Sarah Lin", patientId: "PT-1042", panelId: "cmp", panelName: "Comprehensive Metabolic Panel", status: "resulted", orderedAt: past(5), resultedAt: past(1), provider: "Dr. Rivera", results: [
    { analyte: "Glucose", unit: "mg/dL", range: "70–99", value: 92, flag: "normal" }, { analyte: "BUN", unit: "mg/dL", range: "7–20", value: 14, flag: "normal" }, { analyte: "Creatinine", unit: "mg/dL", range: "0.6–1.3", value: 0.9, flag: "normal" }, { analyte: "eGFR", unit: "mL/min", range: "≥60", value: 95, flag: "normal" }, { analyte: "Sodium", unit: "mmol/L", range: "135–145", value: 139, flag: "normal" }, { analyte: "Potassium", unit: "mmol/L", range: "3.5–5.1", value: 4.2, flag: "normal" }, { analyte: "ALT", unit: "U/L", range: "7–56", value: 61, flag: "high" }, { analyte: "AST", unit: "U/L", range: "10–40", value: 33, flag: "normal" }] },
  { id: "LAB-9003", patientName: "Maria Gomez", patientId: "PT-1051", panelId: "lipid", panelName: "Lipid Panel", status: "ordered", orderedAt: past(1), provider: "Dr. Park" },
  { id: "LAB-9004", patientName: "James Carter", patientId: "PT-1039", panelId: "a1c", panelName: "Hemoglobin A1C", status: "reviewed", orderedAt: past(30), resultedAt: past(26), provider: "Dr. Rivera", results: [{ analyte: "HbA1c", unit: "%", range: "4.0–5.6", value: 5.3, flag: "normal" }], note: "Within range — continue." },
];

interface State {
  orders: LabOrder[];
  seq: number;
  order: (patientName: string, patientId: string | undefined, panelId: string, provider: string) => void;
  enterResults: (id: string) => void;
  markReviewed: (id: string, note?: string) => void;
}
export const useLabs = create<State>((set) => ({
  orders: SEED,
  seq: 9005,
  order: (patientName, patientId, panelId, provider) => set((s) => {
    const p = getPanel(panelId); if (!p) return {};
    return { orders: [{ id: "LAB-" + s.seq, patientName, patientId, panelId, panelName: p.name, status: "ordered", orderedAt: new Date().toISOString(), provider }, ...s.orders], seq: s.seq + 1 };
  }),
  enterResults: (id) => set((s) => ({ orders: s.orders.map((o) => { if (o.id !== id) return o; const p = getPanel(o.panelId); if (!p) return o; return { ...o, status: "resulted", resultedAt: new Date().toISOString(), results: generateResults(p) }; }) })),
  markReviewed: (id, note) => set((s) => ({ orders: s.orders.map((o) => o.id === id ? { ...o, status: "reviewed", note: note ?? o.note } : o) })),
}));
