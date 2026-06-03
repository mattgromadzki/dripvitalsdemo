import type { Claim, PriorAuth } from "@/lib/types";

const PATIENTS = ["Sarah Mitchell", "Marcus Liu", "Priya Krishnan", "Carlos Reyes", "James Thornton", "Anna Bellamy", "Robert Kim"];
const PATIENT_IDS: Record<string, string> = {
  "Sarah Mitchell":  "PT-0041",
  "Marcus Liu":      "PT-0034",
  "Priya Krishnan":  "PT-0031",
  "Carlos Reyes":    "PT-0025",
  "James Thornton":  "PT-0052",
  "Anna Bellamy":    "PT-0027",
  "Robert Kim":      "PT-0018",
};
const PAYERS = ["BlueCross", "Aetna", "UnitedHealthcare", "Cigna", "Medicare"] as const;

const SERVICE_TYPES = [
  { cpt: "99214", label: "Office Visit · Complex",         icd10: "E66.9, I10",   baseBilled: 285 },
  { cpt: "99213", label: "Office Visit · Established",      icd10: "E66.9",        baseBilled: 195 },
  { cpt: "99423", label: "Telehealth Visit · Established",  icd10: "E66.9, E11.9", baseBilled: 165 },
  { cpt: "99204", label: "New Patient · Comprehensive",     icd10: "E66.9, Z00.00",baseBilled: 320 },
  { cpt: "99497", label: "Advance Care Planning",           icd10: "Z71.89",       baseBilled: 165 },
  { cpt: "99354", label: "Prolonged Service · 30-74 min",   icd10: "E11.9",        baseBilled: 145 },
];

const PROVIDERS = ["Dr. Rivera", "Dr. Patel", "Dr. Lee", "NP Wang"];

const DENIAL_CODES = [
  { code: "CO-11", reason: "ICD-10 doesn't support medical necessity for CPT" },
  { code: "CO-16", reason: "Claim lacks information — missing modifier or referring NPI" },
  { code: "CO-29", reason: "Past timely filing limit" },
  { code: "CO-50", reason: "Non-covered service per payer policy" },
  { code: "CO-97", reason: "Payment adjusted — service is part of another procedure" },
];

// Deterministic seeded random
function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export const CLAIMS: Claim[] = (() => {
  const rng = seededRand(42);
  const rows: Claim[] = [];
  // 30 paid, 14 pending, 3 denied = 47
  const statusOrder: Claim["status"][] = [
    ...Array(30).fill("paid"),
    ...Array(14).fill("pending"),
    ...Array(3).fill("denied"),
  ];

  for (let i = 0; i < 47; i++) {
    const status = statusOrder[i];
    const patient = PATIENTS[i % PATIENTS.length];
    const payer = PAYERS[i % PAYERS.length];
    const service = SERVICE_TYPES[i % SERVICE_TYPES.length];
    const billed = service.baseBilled + Math.floor(rng() * 100) - 50;
    // Realistic adjudication ratios per payer
    const payerRate: Record<typeof payer, number> = {
      BlueCross:        0.72,
      Aetna:            0.78,
      UnitedHealthcare: 0.65,
      Cigna:            0.74,
      Medicare:         0.85,
    };
    const paid = status === "paid" ? Math.floor(billed * payerRate[payer]) : 0;
    const patientResp = status === "paid" ? Math.floor(billed * 0.12) : 0;

    // Submission dates trend Apr-May 2026
    const dayOffset = Math.max(1, 26 - Math.floor(i / 3));
    const submittedDate = `May ${dayOffset}, 2026`;
    const submittedAt = parseInt(`20260${dayOffset < 10 ? "0" + dayOffset : dayOffset}`.slice(0, 8), 10);

    let denialReason: string | undefined;
    let denialCode: string | undefined;
    if (status === "denied") {
      const d = DENIAL_CODES[i % DENIAL_CODES.length];
      denialCode = d.code;
      denialReason = d.reason;
    }

    rows.push({
      id: `CLM-${String(200600 + i).padStart(6, "0").slice(-6)}`,
      patientName: patient,
      patientId: PATIENT_IDS[patient],
      payer,
      cptCode: service.cpt,
      serviceLabel: service.label,
      icd10: service.icd10,
      billed,
      paid,
      patientResponsibility: patientResp,
      submittedDate,
      submittedAt,
      status,
      denialCode,
      denialReason,
      providerName: PROVIDERS[i % PROVIDERS.length],
      dateOfService: `May ${Math.max(1, dayOffset - 2)}, 2026`,
    });
  }
  return rows;
})();

export const PRIOR_AUTHS: PriorAuth[] = [
  {
    id: "PA-001",
    patientName: "Marcus Liu", patientId: "PT-0034",
    payer: "BlueCross",
    medication: "Tirzepatide 5mg",
    diagnosis: "E66.9 — Obesity, unspecified · BMI 33.4",
    submittedDate: "May 22, 2026", submittedAt: 20260522,
    status: "pending",
    daysWaiting: 7,
    notes: "Standard PA review — typically 3–5 business days. Following up by phone Day 7.",
  },
  {
    id: "PA-002",
    patientName: "Sarah Mitchell", patientId: "PT-0041",
    payer: "Aetna",
    medication: "Semaglutide 1mg",
    diagnosis: "E66.9 — Obesity · E11.9 — Type 2 DM",
    submittedDate: "May 18, 2026", submittedAt: 20260518,
    status: "approved",
    expiresOn: "Nov 18, 2026",
    daysWaiting: 0,
    notes: "Approved with dose escalation protocol. Renewal required Nov 2026.",
  },
  {
    id: "PA-003",
    patientName: "Carlos Reyes", patientId: "PT-0025",
    payer: "UnitedHealthcare",
    medication: "Semaglutide 0.25mg → 1mg titration",
    diagnosis: "E66.9 — Obesity",
    submittedDate: "May 25, 2026", submittedAt: 20260525,
    status: "submitted",
    daysWaiting: 4,
    notes: "Initial submission. UHC requires step therapy documentation — pulling failed Metformin trial.",
  },
  {
    id: "PA-004",
    patientName: "Anna Bellamy", patientId: "PT-0027",
    payer: "Cigna",
    medication: "Tirzepatide 2.5mg",
    diagnosis: "E66.9 — Obesity · E78.5 — Hyperlipidemia",
    submittedDate: "May 14, 2026", submittedAt: 20260514,
    status: "denied",
    daysWaiting: 0,
    notes: "Denied — Cigna requires documentation of 6mo failed lifestyle modification. Appeal in progress.",
  },
  {
    id: "PA-005",
    patientName: "Robert Kim", patientId: "PT-0018",
    payer: "BlueCross",
    medication: "Semaglutide 1mg",
    diagnosis: "E66.9 — Obesity · E11.9 — DM2",
    submittedDate: "Apr 30, 2026", submittedAt: 20260430,
    status: "approved",
    expiresOn: "Oct 30, 2026",
    daysWaiting: 0,
  },
  {
    id: "PA-006",
    patientName: "James Thornton", patientId: "PT-0052",
    payer: "Medicare",
    medication: "Semaglutide 0.5mg (Wegovy)",
    diagnosis: "E66.01 — Severe obesity · I10 — HTN",
    submittedDate: "May 27, 2026", submittedAt: 20260527,
    status: "pending",
    daysWaiting: 2,
    notes: "Medicare Part D PA. BMI ≥40 documented — strong case.",
  },
];
