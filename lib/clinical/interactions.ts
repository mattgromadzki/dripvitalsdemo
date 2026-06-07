import type { Allergy, MedicationEntry } from "@/lib/clinical/chartTypes";

/**
 * Prescribing decision support — screens a proposed prescription against the
 * patient's structured allergy list and medication list (store:clinical).
 *
 * SCOPE / HONESTY: drug–ALLERGY matching is general (name + ingredient + class).
 * drug–DRUG checking is a SMALL CURATED set focused on the GLP-1 weight-management
 * formulary and common comorbidity meds — NOT a comprehensive interaction database.
 * The UI states this explicitly. Absence of an alert here does not mean a drug pair
 * is safe; it means our limited rule set found nothing.
 */

export type AlertLevel = "danger" | "warning" | "info";
export type AlertKind = "allergy" | "interaction" | "duplicate" | "continuation";

export interface RxAlert {
  id: string;
  kind: AlertKind;
  level: AlertLevel;
  title: string;
  detail: string;
}

export interface DrugRef {
  name: string;
  drugClass?: string;
}

interface Resolved {
  display: string;
  ingredient: string | null;
  classes: string[];
  source: "new" | "current";
}

// Name → canonical ingredient + class tokens. Lowercase, token-based matching.
const INGREDIENT_RULES: { match: RegExp; ingredient: string; classes: string[] }[] = [
  { match: /semaglutide|ozempic|wegovy|rybelsus/i,                          ingredient: "semaglutide",        classes: ["glp-1"] },
  { match: /tirzepatide|mounjaro|zepbound/i,                                ingredient: "tirzepatide",        classes: ["glp-1", "gip"] },
  { match: /liraglutide|saxenda|victoza/i,                                  ingredient: "liraglutide",        classes: ["glp-1"] },
  { match: /dulaglutide|trulicity/i,                                        ingredient: "dulaglutide",        classes: ["glp-1"] },
  { match: /metformin|glucophage/i,                                         ingredient: "metformin",          classes: ["biguanide"] },
  { match: /\binsulin\b|lantus|humalog|novolog|tresiba|glargine|degludec/i, ingredient: "insulin",            classes: ["insulin"] },
  { match: /glipizide|glyburide|glimepiride|sulfonylurea/i,                 ingredient: "sulfonylurea",       classes: ["sulfonylurea"] },
  { match: /lisinopril|enalapril|ramipril|benazepril/i,                     ingredient: "ace-inhibitor",      classes: ["ace-i"] },
  { match: /levothyroxine|synthroid|levoxyl/i,                              ingredient: "levothyroxine",      classes: ["thyroid"] },
  { match: /(oral contraceptive|\bocp\b|birth control|ethinyl|norethindrone|drospirenone|combined ocp)/i, ingredient: "oral-contraceptive", classes: ["oral-contraceptive"] },
  { match: /warfarin|coumadin/i,                                            ingredient: "warfarin",           classes: ["anticoagulant"] },
  { match: /ondansetron|zofran/i,                                           ingredient: "ondansetron",        classes: ["antiemetic"] },
];

const CLASS_NORMALIZE: Record<string, string> = {
  "glp-1": "glp-1", "glp1": "glp-1", "gip/glp-1": "glp-1", "gip": "gip",
  "biguanide": "biguanide", "ace-i": "ace-i", "ace inhibitor": "ace-i",
  "insulin": "insulin", "sulfonylurea": "sulfonylurea", "thyroid": "thyroid",
  "anticoagulant": "anticoagulant", "antiemetic": "antiemetic",
};

function resolve(d: DrugRef, source: "new" | "current"): Resolved {
  const classes = new Set<string>();
  let ingredient: string | null = null;
  for (const rule of INGREDIENT_RULES) {
    if (rule.match.test(d.name)) {
      ingredient = rule.ingredient;
      rule.classes.forEach((c) => classes.add(c));
      break;
    }
  }
  if (d.drugClass) {
    const norm = CLASS_NORMALIZE[d.drugClass.trim().toLowerCase()];
    if (norm) classes.add(norm);
  }
  return { display: d.name, ingredient, classes: [...classes], source };
}

// ── Drug–allergy matching ─────────────────────────────────────────────
// Normalize an allergen string to comparison tokens, expanding common synonyms.
const ALLERGEN_SYNONYMS: { match: RegExp; tokens: string[] }[] = [
  { match: /glp[\s-]?1/i,                          tokens: ["glp-1"] },
  { match: /sulfa|sulfonamide/i,                   tokens: ["sulfonamide"] },
  { match: /ace[\s-]?inhibitor|ace[\s-]?i\b/i,     tokens: ["ace-i", "ace-inhibitor"] },
  { match: /penicillin|amoxicillin|pcn/i,          tokens: ["penicillin"] },
];

function allergenTokens(allergen: string): string[] {
  const base = allergen.trim().toLowerCase();
  const tokens = new Set<string>([base]);
  // word fragments help substring matching against drug names
  base.split(/[\s,/()-]+/).filter((w) => w.length > 2).forEach((w) => tokens.add(w));
  for (const syn of ALLERGEN_SYNONYMS) if (syn.match.test(allergen)) syn.tokens.forEach((t) => tokens.add(t));
  return [...tokens];
}

function allergyHits(drug: Resolved, allergenStr: string): boolean {
  const tokens = allergenTokens(allergenStr);
  const name = drug.display.toLowerCase();
  for (const t of tokens) {
    if (drug.ingredient && (t === drug.ingredient || drug.ingredient.includes(t) || t.includes(drug.ingredient))) return true;
    if (drug.classes.includes(t)) return true;
    if (name.includes(t)) return true;
  }
  return false;
}

const sevToLevel = (s: Allergy["severity"]): AlertLevel =>
  s === "anaphylaxis" || s === "severe" ? "danger" : s === "moderate" ? "warning" : "info";

// ── Curated drug–drug rules (pairwise by class/ingredient token) ──────
interface InteractionRule {
  id: string;
  a: string;
  b: string;
  level: AlertLevel;
  title: string;
  detail: string;
}

const INTERACTION_RULES: InteractionRule[] = [
  { id: "glp1-insulin", a: "glp-1", b: "insulin", level: "warning",
    title: "Additive hypoglycemia risk", detail: "GLP-1 agonist with insulin raises hypoglycemia risk. Consider lowering the insulin dose and counseling on glucose monitoring." },
  { id: "glp1-sulfonylurea", a: "glp-1", b: "sulfonylurea", level: "warning",
    title: "Additive hypoglycemia risk", detail: "GLP-1 agonist with a sulfonylurea raises hypoglycemia risk. Consider reducing the sulfonylurea dose." },
  { id: "glp1-ocp", a: "glp-1", b: "oral-contraceptive", level: "info",
    title: "Reduced oral contraceptive absorption", detail: "GLP-1 agonists (esp. tirzepatide) delay gastric emptying and may lower oral contraceptive efficacy during dose escalation. Advise a backup non-oral method." },
  { id: "glp1-thyroid", a: "glp-1", b: "thyroid", level: "info",
    title: "Levothyroxine absorption may change", detail: "Delayed gastric emptying from GLP-1 therapy can alter levothyroxine absorption. Monitor TSH and separate administration." },
];

function findRepresentative(drugs: Resolved[], token: string): Resolved | undefined {
  return drugs.find((d) => d.classes.includes(token) || d.ingredient === token);
}

export interface ScreenInput {
  proposed: DrugRef[];
  allergies: Allergy[];
  currentMeds: MedicationEntry[];
}

export interface ScreenResult {
  alerts: RxAlert[];
  danger: boolean;
  hasAny: boolean;
}

export function screenPrescription({ proposed, allergies, currentMeds }: ScreenInput): ScreenResult {
  const newDrugs = proposed.map((d) => resolve(d, "new"));
  const currentDrugs = currentMeds
    .filter((m) => m.status === "active")
    .map((m) => resolve({ name: m.name }, "current"));
  const activeAllergies = allergies.filter((a) => a.status === "active");

  const alerts: RxAlert[] = [];

  // 1) Drug–allergy — screen each NEW drug against active allergies.
  for (const drug of newDrugs) {
    for (const a of activeAllergies) {
      if (allergyHits(drug, a.allergen)) {
        const level = sevToLevel(a.severity);
        alerts.push({
          id: `allergy-${drug.display}-${a.id}`,
          kind: "allergy",
          level,
          title: `${level === "danger" ? "Contraindicated" : "Allergy alert"}: ${drug.display} vs ${a.allergen}`,
          detail: `Documented ${a.severity} allergy to ${a.allergen}${a.reaction ? ` (${a.reaction})` : ""}. ${level === "danger" ? "Do not prescribe without an explicit, documented override." : "Confirm tolerability before prescribing."}`,
        });
      }
    }
  }

  // 2) Continuation / same-ingredient — a new drug whose ingredient is already on the chart.
  for (const drug of newDrugs) {
    if (!drug.ingredient) continue;
    const existing = currentDrugs.find((c) => c.ingredient === drug.ingredient);
    if (existing) {
      alerts.push({
        id: `cont-${drug.ingredient}`,
        kind: "continuation",
        level: "info",
        title: `Already on chart: ${drug.ingredient}`,
        detail: `${drug.display} shares an ingredient with a medication already on the patient's list. Confirm this is a continuation/refill and not a duplicate fill.`,
      });
    }
  }

  // 3) Duplicate GLP-1 therapy — two DISTINCT GLP-1 ingredients across new + current.
  const all = [...newDrugs, ...currentDrugs];
  const glp1Ingredients = new Set(all.filter((d) => d.classes.includes("glp-1") && d.ingredient).map((d) => d.ingredient as string));
  const newHasGlp1 = newDrugs.some((d) => d.classes.includes("glp-1"));
  if (glp1Ingredients.size >= 2 && newHasGlp1) {
    alerts.push({
      id: "dup-glp1",
      kind: "duplicate",
      level: "danger",
      title: "Duplicate therapy: two GLP-1 receptor agonists",
      detail: `Patient would be on more than one GLP-1 agonist (${[...glp1Ingredients].join(", ")}). These should not be combined — discontinue one before prescribing.`,
    });
  }

  // 4) Curated pairwise interactions — fire only when ≥1 NEW drug is involved.
  for (const rule of INTERACTION_RULES) {
    const aDrug = findRepresentative(all, rule.a);
    const bDrug = findRepresentative(all, rule.b);
    if (!aDrug || !bDrug || aDrug === bDrug) continue;
    if (aDrug.source !== "new" && bDrug.source !== "new") continue;
    alerts.push({
      id: `int-${rule.id}`,
      kind: "interaction",
      level: rule.level,
      title: rule.title,
      detail: `${rule.detail} (${aDrug.display} + ${bDrug.display})`,
    });
  }

  // De-dupe by id, keep highest severity ordering for display.
  const seen = new Set<string>();
  const deduped = alerts.filter((al) => (seen.has(al.id) ? false : (seen.add(al.id), true)));
  const order: Record<AlertLevel, number> = { danger: 0, warning: 1, info: 2 };
  deduped.sort((x, y) => order[x.level] - order[y.level]);

  return { alerts: deduped, danger: deduped.some((a) => a.level === "danger"), hasAny: deduped.length > 0 };
}
