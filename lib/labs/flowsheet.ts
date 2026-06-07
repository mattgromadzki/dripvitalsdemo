import { useClinical } from "@/lib/hooks/useClinical";
import { clinId, type VitalEntry } from "@/lib/clinical/chartTypes";
import type { LabOrder } from "@/lib/labs/types";
import type { Patient } from "@/lib/types";

/**
 * Results loop → flowsheet. When a lab is resulted, the trendable analytes flow
 * into the structured vitals flowsheet (store:clinical) so they show up on the
 * same time series as weight/BMI/BP. Today the clean mapping is HbA1c → the
 * flowsheet's a1c column (the analyte the flowsheet already trends and the one
 * that matters most for GLP-1 management). Other analytes have no flowsheet
 * column yet, so they stay in the lab record.
 */

const A1C_NAME = /^(hba1c|a1c|hemoglobin\s*a1c)$/i;

export function a1cFromOrder(o: LabOrder): number | null {
  const r = (o.results || []).find((x) => A1C_NAME.test(x.analyte.trim()));
  return r ? r.value : null;
}

/** True if this lab carries an analyte that maps to the flowsheet. */
export function hasFlowsheetData(o: LabOrder): boolean {
  return a1cFromOrder(o) != null;
}

/** True once a flowsheet entry sourced from this lab already exists. */
export function alreadyInFlowsheet(patientId: string | undefined, o: LabOrder): boolean {
  if (!patientId) return false;
  const chart = useClinical.getState().charts[patientId];
  return !!chart?.vitals.some((v) => v.note === `Lab ${o.id}`);
}

/**
 * Idempotently add an A1C flowsheet entry from a resulted lab.
 * Seeds the chart first so we never clobber the seeded problem/med/allergy data.
 * Returns true if a new entry was added.
 */
export function pushLabToFlowsheet(patient: Patient | undefined, o: LabOrder): boolean {
  if (!patient) return false;
  const a1c = a1cFromOrder(o);
  if (a1c == null) return false;

  const st = useClinical.getState();
  st.ensureSeeded(patient.id, patient); // guard: build the seed before adding a vital
  if (alreadyInFlowsheet(patient.id, o)) return false;

  const date = (o.resultedAt || o.orderedAt || new Date().toISOString()).slice(0, 10);
  const entry: VitalEntry = { id: clinId("vit_"), date, a1c, note: `Lab ${o.id}` };
  useClinical.getState().addVital(patient.id, entry);
  return true;
}
