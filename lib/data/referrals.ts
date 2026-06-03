import type { Referral, Specialist, ReferralStatus, ReferralUrgency, ReferralSpecialty } from "@/lib/types";

export const SPECIALISTS: Specialist[] = [
  {
    id: "SP-001",
    name: "Dr. Emily Wang",
    credentials: "MD",
    specialty: "Endocrinology",
    practice: "Miami Endocrine Associates",
    city: "Miami", state: "FL",
    phone: "(305) 555-0210",
    email: "ewang@miamiendocrine.com",
    fax: "(305) 555-0211",
    npi: "1023456789",
    acceptingNew: true,
    inNetworkPayers: ["BlueCross", "Aetna", "UnitedHealthcare", "Cigna"],
    avgResponseDays: 2.4,
    totalReferralsSent: 18,
    color: "var(--color-brand)",
    notes: "Preferred endo. Same-day phone consult available for urgent. Strong with GLP-1 escalation cases.",
  },
  {
    id: "SP-002",
    name: "Dr. Robert Singh",
    credentials: "MD",
    specialty: "Cardiology",
    practice: "South Florida Heart Center",
    city: "Fort Lauderdale", state: "FL",
    phone: "(954) 555-0220",
    email: "rsingh@sfheart.com",
    fax: "(954) 555-0221",
    npi: "1023456790",
    acceptingNew: true,
    inNetworkPayers: ["BlueCross", "Aetna", "UnitedHealthcare", "Medicare"],
    avgResponseDays: 3.1,
    totalReferralsSent: 12,
    color: "var(--color-coral)",
  },
  {
    id: "SP-003",
    name: "Dr. Lisa Park",
    credentials: "MD",
    specialty: "Gastroenterology",
    practice: "Coastal GI Clinic",
    city: "Boca Raton", state: "FL",
    phone: "(561) 555-0230",
    email: "lpark@coastalgi.com",
    npi: "1023456791",
    acceptingNew: true,
    inNetworkPayers: ["BlueCross", "Aetna", "Cigna"],
    avgResponseDays: 4.2,
    totalReferralsSent: 9,
    color: "var(--color-purple)",
    notes: "Sees most GLP-1 GI side-effect cases. Endoscopy scheduling typically 3-4 weeks out.",
  },
  {
    id: "SP-004",
    name: "Dr. James Chen",
    credentials: "MD, PsyD",
    specialty: "Psychiatry",
    practice: "Wellness Behavioral Health",
    city: "Aventura", state: "FL",
    phone: "(305) 555-0240",
    email: "jchen@wellnessbh.com",
    npi: "1023456792",
    acceptingNew: false,
    inNetworkPayers: ["Aetna", "UnitedHealthcare"],
    avgResponseDays: 5.8,
    totalReferralsSent: 6,
    color: "var(--color-teal)",
    notes: "Currently waitlisted (~6 weeks). For urgent psych refer to Dr. Martinez at SFL Behavioral.",
  },
  {
    id: "SP-005",
    name: "Dr. Maria Lopez",
    credentials: "RD, CDN",
    specialty: "Dietitian",
    practice: "Lopez Nutrition Consulting",
    city: "Coral Gables", state: "FL",
    phone: "(305) 555-0250",
    email: "maria@lopeznutrition.com",
    npi: "1023456793",
    acceptingNew: true,
    inNetworkPayers: ["BlueCross", "Aetna", "UnitedHealthcare", "Cigna", "Self-Pay"],
    avgResponseDays: 1.8,
    totalReferralsSent: 22,
    color: "var(--color-green)",
    notes: "Excellent for plateau cases. Offers telehealth. $120/visit self-pay.",
  },
  {
    id: "SP-006",
    name: "Dr. Aisha Patel",
    credentials: "MD",
    specialty: "Sleep Medicine",
    practice: "Florida Sleep Institute",
    city: "Miami", state: "FL",
    phone: "(305) 555-0260",
    email: "apatel@flsleepinst.com",
    npi: "1023456794",
    acceptingNew: true,
    inNetworkPayers: ["BlueCross", "Aetna", "Medicare"],
    avgResponseDays: 6.4,
    totalReferralsSent: 4,
    color: "var(--color-violet)",
  },
  {
    id: "SP-007",
    name: "Dr. Thomas Greene",
    credentials: "MD, FACS",
    specialty: "Bariatric Surgery",
    practice: "Baptist Health Bariatrics",
    city: "Miami", state: "FL",
    phone: "(305) 555-0270",
    fax: "(305) 555-0271",
    npi: "1023456795",
    acceptingNew: true,
    inNetworkPayers: ["BlueCross", "Aetna", "UnitedHealthcare", "Cigna", "Medicare"],
    avgResponseDays: 7.2,
    totalReferralsSent: 3,
    color: "var(--color-amber)",
    notes: "Last-resort referrals for patients who plateau or are intolerant of GLP-1s.",
  },
];

const PATIENTS = [
  { name: "Sarah Mitchell",  id: "PT-0041", color: "var(--color-coral)" },
  { name: "Marcus Liu",      id: "PT-0034", color: "var(--color-violet)" },
  { name: "Priya Krishnan",  id: "PT-0031", color: "var(--color-teal)" },
  { name: "Carlos Reyes",    id: "PT-0025", color: "var(--color-blue)" },
  { name: "James Thornton",  id: "PT-0052", color: "var(--color-amber)" },
  { name: "Anna Bellamy",    id: "PT-0027", color: "var(--color-purple)" },
];

const REASONS_BY_SPECIALTY: Record<ReferralSpecialty, string[]> = {
  "Endocrinology":      ["Thyroid evaluation — TSH 6.8", "Suspected hypogonadism", "GLP-1 escalation oversight"],
  "Cardiology":         ["BP control · stage 2 HTN", "Palpitations during GLP-1 titration", "Pre-treatment cardiac risk assessment"],
  "Gastroenterology":   ["Persistent nausea/vomiting (4+ weeks)", "Suspected gastroparesis", "Severe constipation refractory to therapy"],
  "Dietitian":          ["Weight plateau coaching", "Nutrition counseling — type 2 diabetes", "Macro guidance during GLP-1 titration"],
  "Psychiatry":         ["Mood changes on GLP-1", "Disordered eating evaluation", "Anxiety + appetite suppression interaction"],
  "Sleep Medicine":     ["Suspected OSA · STOP-BANG 5", "Insomnia worsening on GLP-1"],
  "Bariatric Surgery":  ["GLP-1 plateau · considering surgical options", "Pre-surgical evaluation"],
  "Primary Care":       ["Establish PCP for ongoing care", "Annual physical"],
  "Other":              ["Specialist consultation"],
};

// Deterministic seeded random
function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function makeReferrals(): Referral[] {
  const rng = seededRand(7);
  const refs: Referral[] = [];

  // Distribution: 10 pending, 8 scheduled, 7 completed, 2 cancelled, 3 incoming
  const slots: ReferralStatus[] = [
    ...Array(10).fill("pending"),
    ...Array(8).fill("scheduled"),
    ...Array(7).fill("completed"),
    ...Array(2).fill("cancelled"),
    ...Array(3).fill("incoming"),
  ];

  // Urgency distribution
  const urgencies: ReferralUrgency[] = ["Routine", "Routine", "Routine", "Urgent", "Routine", "STAT", "Routine", "Routine", "Urgent", "Routine"];

  for (let i = 0; i < 28; i++) {
    const status = slots[i];
    const isIncoming = status === "incoming";
    const patient = PATIENTS[i % PATIENTS.length];
    const specialist = SPECIALISTS[i % SPECIALISTS.length];
    const specialty = specialist.specialty;
    const reasons = REASONS_BY_SPECIALTY[specialty];
    const reason = reasons[i % reasons.length];
    const urgency = urgencies[i % urgencies.length];

    // Dates trend Apr-May 2026
    const daysAgo = i + 1;
    const dayOfMonth = Math.max(1, 28 - daysAgo);
    const sentDate = `May ${dayOfMonth}, 2026`;
    const sentAt = parseInt(`202605${String(dayOfMonth).padStart(2, "0")}`, 10);

    let scheduledDate: string | undefined;
    let completedDate: string | undefined;
    if (status === "scheduled") {
      const day = Math.min(31, dayOfMonth + Math.ceil(specialist.avgResponseDays + 3));
      scheduledDate = `Jun ${Math.max(1, day - 28)}, 2026`;
    }
    if (status === "completed") {
      const day = Math.min(31, dayOfMonth + Math.ceil(specialist.avgResponseDays + 5));
      completedDate = `May ${Math.min(28, day)}, 2026`;
    }

    const authorizationRequired = (urgency === "Routine" && rng() > 0.5);
    const authStatus: Referral["authStatus"] = authorizationRequired
      ? (status === "completed" || status === "scheduled" ? "approved" : rng() > 0.7 ? "pending" : "approved")
      : "not_required";

    refs.push({
      id: `REF-${String(20260001 + i).slice(-5)}`,
      patientName: patient.name,
      patientId: patient.id,
      patientColor: patient.color,
      specialistId: specialist.id,
      specialistName: specialist.name,
      specialty,
      reason,
      clinicalNotes: `Patient on Semaglutide 0.5mg/wk · BMI ${(rng() * 8 + 28).toFixed(1)} · Last visit ${dayOfMonth} days ago. Please assess and report findings.`,
      urgency,
      status,
      direction: isIncoming ? "incoming" : "outgoing",
      sentDate,
      sentAt,
      scheduledDate,
      completedDate,
      appointmentNotes: status === "completed" ? "Patient seen. Findings reported in chart. Co-management plan agreed." : undefined,
      authorizationRequired,
      authStatus,
    });
  }

  return refs.sort((a, b) => b.sentAt - a.sentAt);
}

export const REFERRALS: Referral[] = makeReferrals();
