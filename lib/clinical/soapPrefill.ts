import type { ClinicalChart } from "@/lib/clinical/chartTypes";

/**
 * Turns the structured clinical chart (store:clinical) into SOAP-note text so
 * encounter notes are grounded in coded data: the active problem list seeds the
 * Assessment, the active medication list seeds the Plan, and the latest vitals +
 * structured allergies seed the Objective. Used both to prefill a fresh note and
 * to power the "insert into section" actions in the editor.
 */

const activeProblems = (c: ClinicalChart) => c.problems.filter((p) => p.status === "active");
const activeMeds = (c: ClinicalChart) => c.meds.filter((m) => m.status === "active");
const activeAllergies = (c: ClinicalChart) => c.allergies.filter((a) => a.status === "active");

export function formatAllergiesLine(c: ClinicalChart): string {
  const al = activeAllergies(c);
  if (al.length) {
    return "Allergies: " + al.map((a) => (a.reaction ? `${a.allergen} (${a.reaction}, ${a.severity})` : `${a.allergen} (${a.severity})`)).join("; ");
  }
  if (c.nkda) return "Allergies: NKDA";
  return "Allergies: none recorded";
}

export function formatProblemsForAssessment(c: ClinicalChart): string {
  const ps = activeProblems(c);
  if (!ps.length) return "";
  return ps.map((p) => `- ${p.code} — ${p.label}`).join("\n");
}

export function formatMedsForPlan(c: ClinicalChart): string {
  const ms = activeMeds(c);
  if (!ms.length) return "";
  return ms.map((m) => {
    const detail = [m.dose, m.route, m.frequency].filter(Boolean).join(" ");
    return `- Continue ${m.name}${detail ? ` ${detail}` : ""}`;
  }).join("\n");
}

export function formatVitalsForObjective(c: ClinicalChart): string {
  const v = c.vitals[0]; // store keeps vitals newest-first
  if (!v) return "";
  const parts: string[] = [];
  if (v.weightLb != null) parts.push(`Wt ${v.weightLb} lb`);
  if (v.bmi != null) parts.push(`BMI ${v.bmi}`);
  if (v.systolic != null && v.diastolic != null) parts.push(`BP ${v.systolic}/${v.diastolic}`);
  if (v.hr != null) parts.push(`HR ${v.hr} bpm`);
  if (v.a1c != null) parts.push(`A1C ${v.a1c}%`);
  if (!parts.length) return "";
  return `Vitals (${v.date}): ${parts.join(", ")}`;
}

/** Append a block to an existing section without clobbering what's there. */
export function appendBlock(existing: string, block: string): string {
  if (!block) return existing;
  if (!existing.trim()) return block;
  return existing.replace(/\s*$/, "") + "\n" + block;
}

/** Objective string = latest vitals + allergies (the two structured "O" facts). */
export function formatObjective(c: ClinicalChart): string {
  return [formatVitalsForObjective(c), formatAllergiesLine(c)].filter(Boolean).join("\n");
}

/** Seed values for a brand-new note created against a patient's chart. */
export function prefillSections(c: ClinicalChart): { o: string; a: string; p: string } {
  return {
    o: formatObjective(c),
    a: formatProblemsForAssessment(c),
    p: formatMedsForPlan(c),
  };
}
