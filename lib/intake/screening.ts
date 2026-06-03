import type { IntakeAnswers } from "./types";
export type Severity = "critical" | "warning" | "info";
export interface Flag { severity: Severity; label: string; detail: string; }

export function bmiOf(heightIn: number, weightLb: number): number {
  if (!heightIn || !weightLb) return 0;
  return +((weightLb / (heightIn * heightIn)) * 703).toFixed(1);
}

export function computeFlags(a: IntakeAnswers): Flag[] {
  const f: Flag[] = [];
  if (a.mtcOrMen2) f.push({ severity: "critical", label: "MTC / MEN2 history", detail: "Personal or family history of medullary thyroid carcinoma or MEN2 — GLP-1 therapy is contraindicated." });
  if (a.pregnantOrNursing) f.push({ severity: "critical", label: "Pregnant / breastfeeding", detail: "GLP-1 therapy is contraindicated during pregnancy and lactation." });
  if (a.pancreatitis) f.push({ severity: "warning", label: "Pancreatitis history", detail: "History of pancreatitis — weigh risk, counsel, and monitor closely." });
  if (a.gallbladder) f.push({ severity: "warning", label: "Gallbladder disease", detail: "Gallbladder disease — increased risk of cholelithiasis on GLP-1." });
  if (a.eatingDisorder) f.push({ severity: "warning", label: "Eating disorder", detail: "History of eating disorder — screen carefully before initiating." });
  if (a.kidneyDisease) f.push({ severity: "info", label: "Kidney disease", detail: "Renal impairment — monitor for dehydration with GI side effects." });
  if (a.bmi && a.bmi < 27) f.push({ severity: "warning", label: "BMI below threshold", detail: `BMI ${a.bmi} is below the typical treatment threshold (≥27 with comorbidity, ≥30 otherwise).` });
  return f;
}

export function recommendation(flags: Flag[]): "approve" | "review" | "deny" {
  if (flags.some((f) => f.severity === "critical")) return "deny";
  if (flags.some((f) => f.severity === "warning")) return "review";
  return "approve";
}
