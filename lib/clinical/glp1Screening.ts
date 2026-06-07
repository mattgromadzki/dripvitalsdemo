import type { BaskQuestion, BaskOption } from "@/lib/types/treatmentsIntake";

/**
 * GLP-1 contraindication screening — the single source of truth for both the
 * patient intake flow (which blocks on absolute contraindications) and the
 * provider review surfaces (which show relative contraindications to weigh).
 *
 * IMPORTANT — clinical disclaimer:
 * This logic is a STARTING TEMPLATE based on commonly-cited GLP-1 contraindications
 * and cautions. It is not medical advice and must be reviewed, adjusted, and signed
 * off by your medical director / licensed providers before use with real patients.
 * Thresholds (e.g. BMI), what counts as an absolute vs. relative contraindication,
 * and the questions asked are clinical-policy decisions your providers must own.
 *
 * Two tiers:
 *  - "disqualifier" (block): absolute contraindications — patient cannot proceed
 *    online (e.g. MTC/MEN2 history, pregnancy/breastfeeding, gastroparesis, < 18).
 *  - "review" (flag, but allow): relative contraindications / cautions a provider
 *    should weigh before prescribing (e.g. pancreatitis history, gallbladder
 *    disease, eating-disorder history, T1D / insulin use, low BMI).
 */

export const GLP1_SCREENING_NOTE =
  "Screening template only — must be reviewed and approved by your medical director. Not medical advice.";

export type ScreenAnswer = string | number | string[] | undefined;
type AnswerMap = Record<number, string | number | string[]>;

const optLabel = (o: BaskOption) => (typeof o === "string" ? o : o.label);

function parseDob(v: string): Date | null {
  try {
    if (v.startsWith("{")) {
      const o = JSON.parse(v);
      if (o.y && o.m && o.d) return new Date(+o.y, +o.m - 1, +o.d);
      return null;
    }
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/** Absolute contraindication → returns the blocking reason, else null. */
export function disqualifierReason(q: BaskQuestion, v: ScreenAnswer): string | null {
  if (q.impact !== "disqualifier") return null;
  if (q.type === "yesno" && v === "Yes") return q.text;
  if (q.type === "checkbox" && Array.isArray(v)) {
    const hits = v.filter((val) => {
      const opt = (q.options || []).find((o) => optLabel(o) === val);
      return opt && typeof opt === "object" && opt.flag === "disq";
    });
    if (hits.length) return hits.join(", ");
  }
  if (q.type === "date" && typeof v === "string" && v) {
    const dob = parseDob(v);
    if (dob && (Date.now() - dob.getTime()) / 31557600000 < 18) return "Under 18 years old";
  }
  return null;
}

/** Relative contraindications / cautions → returns reasons to flag for review. */
export function reviewReasons(q: BaskQuestion, v: ScreenAnswer): string[] {
  const out: string[] = [];
  // A "review"-impact yes/no answered "Yes".
  if (q.impact === "review" && q.type === "yesno" && v === "Yes") out.push(q.text);
  // Any checkbox option explicitly flagged "review" (independent of the question's overall impact).
  if (q.type === "checkbox" && Array.isArray(v)) {
    for (const val of v) {
      const opt = (q.options || []).find((o) => optLabel(o) === val);
      if (opt && typeof opt === "object" && opt.flag === "review") out.push(val);
    }
  }
  // BMI below the typical treatment threshold (eligibility caution, not a hard block).
  if (q.type === "bmi" && typeof v === "string" && v.startsWith("{")) {
    try {
      const o = JSON.parse(v);
      const bmi = +o.bmi;
      if (bmi && bmi < 27) out.push(`BMI ${bmi} is below the typical threshold (≥27 with comorbidity, ≥30 otherwise) — confirm eligibility`);
    } catch { /* ignore */ }
  }
  return out;
}

export interface ScreenResult {
  decision: "block" | "review" | "clear";
  disqualifiers: string[];
  reviewFlags: string[];
}

/** Evaluate a full set of answers against a form's questions. */
export function screenAnswers(questions: BaskQuestion[], answers: AnswerMap): ScreenResult {
  const disq: string[] = [];
  const rev: string[] = [];
  for (const q of questions || []) {
    const v = answers?.[q.id];
    const d = disqualifierReason(q, v);
    if (d) disq.push(d);
    rev.push(...reviewReasons(q, v));
  }
  const uniq = (a: string[]) => Array.from(new Set(a));
  const disqualifiers = uniq(disq);
  const reviewFlags = uniq(rev);
  return {
    decision: disqualifiers.length ? "block" : reviewFlags.length ? "review" : "clear",
    disqualifiers,
    reviewFlags,
  };
}
