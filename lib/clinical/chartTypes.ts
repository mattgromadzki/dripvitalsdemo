import type { Patient } from "@/lib/types";

/**
 * Structured, coded clinical data — the foundation the rest of the EMR builds on.
 * Replaces flat strings (e.g. allergies: "None") with coded, queryable records:
 * an ICD-10 problem list, a structured allergy list, a medication list, and a
 * vitals flowsheet (time series) instead of single scalar values.
 */

export type ProblemStatus = "active" | "resolved";
export interface Problem { id: string; code: string; label: string; status: ProblemStatus; onset?: string; note?: string; }

export type AllergySeverity = "mild" | "moderate" | "severe" | "anaphylaxis";
export type AllergyStatus = "active" | "inactive";
export interface Allergy { id: string; allergen: string; reaction?: string; severity: AllergySeverity; status: AllergyStatus; }

export type MedStatus = "active" | "discontinued";
export interface MedicationEntry { id: string; name: string; dose?: string; route?: string; frequency?: string; status: MedStatus; rxnorm?: string; startedOn?: string; note?: string; }

/** One dated set of vitals. Each measure is optional so partial entries are fine. */
export interface VitalEntry { id: string; date: string; weightLb?: number; bmi?: number; systolic?: number; diastolic?: number; hr?: number; a1c?: number; note?: string; }

export interface ClinicalChart {
  problems: Problem[];
  allergies: Allergy[];
  nkda?: boolean;          // "no known drug allergies" asserted
  meds: MedicationEntry[];
  vitals: VitalEntry[];    // newest first
}

export const EMPTY_CHART: ClinicalChart = { problems: [], allergies: [], meds: [], vitals: [], nkda: false };

/** Common GLP-1-program ICD-10 codes for the problem-list picker (plus free entry). */
export const ICD10_COMMON: { code: string; label: string }[] = [
  { code: "E66.9", label: "Obesity, unspecified" },
  { code: "E66.01", label: "Morbid (severe) obesity, excess calories" },
  { code: "E66.3", label: "Overweight" },
  { code: "E11.9", label: "Type 2 diabetes mellitus, no complications" },
  { code: "R73.03", label: "Prediabetes" },
  { code: "E78.5", label: "Hyperlipidemia, unspecified" },
  { code: "E78.00", label: "Pure hypercholesterolemia" },
  { code: "I10", label: "Essential (primary) hypertension" },
  { code: "E03.9", label: "Hypothyroidism, unspecified" },
  { code: "K21.9", label: "GERD without esophagitis" },
  { code: "G47.33", label: "Obstructive sleep apnea" },
  { code: "E28.2", label: "Polycystic ovarian syndrome" },
  { code: "M19.90", label: "Osteoarthritis, unspecified site" },
  { code: "F41.9", label: "Anxiety disorder, unspecified" },
];

/** Medication-name suggestions (datalist) for the med-list picker. */
export const COMMON_MEDS: string[] = [
  "Compounded Semaglutide", "Compounded Tirzepatide",
  "Semaglutide (Wegovy)", "Semaglutide (Ozempic)", "Tirzepatide (Zepbound)", "Tirzepatide (Mounjaro)",
  "Metformin", "Lisinopril", "Atorvastatin", "Levothyroxine", "Omeprazole",
  "Ondansetron (Zofran)", "Vitamin B12", "Multivitamin", "Birth control (combined OCP)",
];

export const ROUTES = ["Subcutaneous", "Oral", "Topical", "Intramuscular", "Other"];
export const FREQUENCIES = ["Once weekly", "Once daily", "Twice daily", "As needed", "Other"];

let seq = 0;
export function clinId(prefix: string): string { return `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}`; }

/** Build a starter chart from a patient's existing flat fields. */
export function seedChart(patient: Patient): ClinicalChart {
  const problems: Problem[] = [];
  if (patient.bmi >= 30) problems.push({ id: clinId("prob_"), code: "E66.9", label: "Obesity, unspecified", status: "active", onset: patient.startDate });
  else if (patient.bmi >= 27) problems.push({ id: clinId("prob_"), code: "E66.3", label: "Overweight", status: "active", onset: patient.startDate });
  if (typeof patient.a1c === "number" && patient.a1c >= 6.5) problems.push({ id: clinId("prob_"), code: "E11.9", label: "Type 2 diabetes mellitus, no complications", status: "active" });
  else if (typeof patient.a1c === "number" && patient.a1c >= 5.7) problems.push({ id: clinId("prob_"), code: "R73.03", label: "Prediabetes", status: "active" });

  const raw = (patient.allergies || "").trim();
  const none = !raw || /^(none|nkda|no known|n\/a|na)$/i.test(raw);
  const allergies: Allergy[] = none ? [] : raw.split(/[,;]+/).map((s) => s.trim()).filter(Boolean)
    .map((allergen) => ({ id: clinId("alg_"), allergen, severity: "moderate" as AllergySeverity, status: "active" as AllergyStatus }));

  const meds: MedicationEntry[] = [];
  if (patient.plan || patient.dose) {
    meds.push({ id: clinId("med_"), name: patient.plan || "GLP-1 therapy", dose: patient.dose || undefined, route: "Subcutaneous", frequency: "Once weekly", status: "active", startedOn: patient.startDate, note: "Program medication" });
  }

  const vitals: VitalEntry[] = [];
  const [sys, dia] = (patient.bp || "").split("/").map((x) => parseInt(x, 10));
  vitals.push({
    id: clinId("vit_"),
    date: patient.lastVisit || patient.startDate || new Date().toISOString().slice(0, 10),
    weightLb: patient.wt || undefined,
    bmi: patient.bmi || undefined,
    systolic: Number.isFinite(sys) ? sys : undefined,
    diastolic: Number.isFinite(dia) ? dia : undefined,
    hr: patient.hr || undefined,
    a1c: typeof patient.a1c === "number" ? patient.a1c : undefined,
    note: "Most recent",
  });
  if (patient.wtStart && patient.wtStart !== patient.wt) {
    vitals.push({ id: clinId("vit_"), date: patient.startDate || "", weightLb: patient.wtStart, note: "Start of program" });
  }

  return { problems, allergies, nkda: none, meds, vitals };
}
