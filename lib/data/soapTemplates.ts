export interface SoapTemplate {
  id: string;
  label: string;
  icon: string;
  type: string;        // becomes the note's type field
  s: string;
  o: string;
  a: string;
  p: string;
}

export const SOAP_TEMPLATES: SoapTemplate[] = [
  {
    id: "glp1-checkin",
    label: "GLP-1 Check-in",
    icon: "💉",
    type: "GLP-1 Check-in",
    s: "Chief complaint: GLP-1 follow-up. [Tolerance: well/with side effects]. [Weight change since last visit]. Denies nausea, vomiting, abdominal pain. [Energy/appetite changes].",
    o: "Weight: ___ lbs · BMI: ___ · BP: ___ · HR: ___\nLabs (date): HbA1c ___, LDL ___, HDL ___, Fasting glucose ___.",
    a: "1. Obesity (E66.9) — [Progress: on track / behind / accelerating]. ___ lbs over ___ weeks.\n2. [Other dx codes as applicable]",
    p: "1. Continue [current GLP-1] [dose] SC weekly.\n2. [Concomitant medications].\n3. [Follow-up timing].\n4. [Labs/imaging if needed].",
  },
  {
    id: "initial-consult",
    label: "Initial Consult",
    icon: "📋",
    type: "Initial Consultation",
    s: "New patient intake. Chief complaint: [weight management / metabolic concerns].\nPMH: [conditions]. PSH: [surgeries]. Allergies: [NKDA / list].\nFH: [family hx of MTC, MEN-2, pancreatitis, diabetes].\nSH: [smoking, alcohol, exercise]. Failed prior weight loss attempts: [methods].",
    o: "Weight: ___ lbs · Height: ___ · BMI: ___ · BP: ___ · HR: ___\nLabs: pending.",
    a: "1. Obesity (E66.9) — Class [I/II/III]. Candidate for GLP-1 therapy.\n2. [Comorbidities].",
    p: "1. Order baseline labs (CMP, HbA1c, lipid, TSH).\n2. Pending labs, consider initiating Semaglutide 0.25mg weekly × 4 weeks, then escalate per protocol.\n3. Lifestyle counseling.\n4. F/U in 2 weeks to review labs and initiate therapy.\n5. Reviewed: GLP-1 risks (nausea, pancreatitis, MTC), boxed warnings, contraindications.",
  },
  {
    id: "lab-review",
    label: "Lab Review",
    icon: "🧪",
    type: "Lab Review",
    s: "Patient contacted regarding lab results. [Symptomatic status]. [Adherence to therapy].",
    o: "Labs (date):\n- HbA1c: ___ (prev ___)\n- Lipid panel: TC ___, LDL ___, HDL ___, Triglycerides ___\n- CMP: [WNL / abnormalities]\n- [Other]",
    a: "1. [Primary dx] — [Response interpretation].\n2. [Lab-flagged abnormalities].",
    p: "1. [Continue / adjust] current regimen.\n2. [Add interventions for any abnormal findings].\n3. Repeat labs in ___ weeks.\n4. F/U in ___ weeks.",
  },
  {
    id: "weight-check",
    label: "Weight Check",
    icon: "📊",
    type: "Weight Check",
    s: "Brief weight check visit. Patient reports [adherence], [side effect status], [weight loss progress].",
    o: "Weight today: ___ lbs (baseline ___, last visit ___)\nChange: ___ lbs since last visit\nTotal change since baseline: ___ lbs (___%)\nBP: ___ · HR: ___",
    a: "Obesity (E66.9) — [Trajectory: on track / plateaued / regaining]. [Net change] over [time].",
    p: "1. [Continue current dose / escalate / pause].\n2. [Behavioral counseling if needed].\n3. F/U in 4 weeks.",
  },
];
