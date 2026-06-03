import type { ConsentForm, ConsentSignature } from "@/lib/types";

export const CONSENT_FORMS: ConsentForm[] = [
  {
    id: "CF-001",
    name: "HIPAA Notice of Privacy Practices",
    slug: "hipaa-privacy-notice",
    category: "HIPAA",
    description: "Required HIPAA disclosure of how patient PHI is used, disclosed, and protected.",
    version: "v3.2",
    effectiveDate: "Jan 14, 2026",
    signaturesCount: 274,
    pendingCount: 10,
    lastUpdated: "Jan 14, 2026",
    lastUpdatedAt: 20260114,
    isActive: true,
    requiredAtEnrollment: true,
    retentionYears: 7,
    body: `**Effective Date:** January 14, 2026

This notice describes how medical information about you may be used and disclosed and how you can get access to this information. Please review carefully.

**Our Privacy Practices**

We are required by law to maintain the privacy of your protected health information (PHI) and to provide you with this Notice of our legal duties and privacy practices.

**Uses and Disclosures**

We may use and disclose your PHI for the following purposes:
- Treatment: To coordinate care with your providers, pharmacy, and laboratory partners.
- Payment: To bill insurance carriers and collect payment for services.
- Healthcare Operations: For quality improvement, training, and compliance auditing.

**Your Rights**

You have the right to:
- Request a copy of your medical records (45 CFR §164.524)
- Request restrictions on certain uses and disclosures
- Request amendments to your records you believe are incorrect
- Receive an accounting of disclosures we have made
- File a complaint with the U.S. Department of Health and Human Services

**Contact**

If you have questions or wish to exercise any rights, contact our Privacy Officer at privacy@dripvitals.health or (305) 555-0100.

By signing below, you acknowledge that you have received and reviewed this Notice of Privacy Practices.`,
  },
  {
    id: "CF-002",
    name: "GLP-1 Treatment Informed Consent",
    slug: "glp1-informed-consent",
    category: "Treatment",
    description: "Patient understanding of GLP-1 medication therapy, benefits, alternatives, and risks.",
    version: "v2.1",
    effectiveDate: "Mar 10, 2026",
    signaturesCount: 284,
    pendingCount: 0,
    lastUpdated: "Mar 10, 2026",
    lastUpdatedAt: 20260310,
    isActive: true,
    requiredAtEnrollment: true,
    retentionYears: 7,
    body: `**Effective Date:** March 10, 2026

I understand that I have been prescribed a GLP-1 receptor agonist medication (Semaglutide or Tirzepatide) for chronic weight management.

**Treatment Overview**

GLP-1 medications work by mimicking a hormone that reduces appetite, slows gastric emptying, and improves blood sugar regulation. Treatment typically continues for at least 12 months for optimal outcomes.

**Expected Benefits**
- Reduced appetite and food cravings
- Average weight loss of 12-15% of body weight over 12 months
- Improved blood sugar control
- Potential reduction in cardiovascular risk factors

**Material Risks and Side Effects**
- Common: nausea, vomiting, diarrhea, constipation, headache, fatigue
- Less common: gallbladder disease, kidney problems, dehydration
- Rare but serious: pancreatitis, thyroid C-cell tumors, severe allergic reactions

**Alternatives Discussed**
- Lifestyle modification alone (diet, exercise, behavioral support)
- Other anti-obesity medications (phentermine, naltrexone/bupropion)
- Bariatric surgery for eligible patients
- No treatment

**Compounded Medication Notice**

If prescribed a compounded version of Semaglutide or Tirzepatide, I understand:
- Compounded medications are not FDA-approved for weight loss
- They are prepared by licensed compounding pharmacies under USP standards
- Quality and consistency may differ from brand-name FDA-approved versions

By signing, I confirm that I have discussed this treatment with my provider, my questions have been answered, and I voluntarily consent to begin treatment.`,
  },
  {
    id: "CF-003",
    name: "GLP-1 Side Effects Acknowledgment",
    slug: "glp1-side-effects",
    category: "Treatment",
    description: "Specific acknowledgment of GLP-1 side effects and contraindications.",
    version: "v1.4",
    effectiveDate: "May 1, 2026",
    signaturesCount: 283,
    pendingCount: 1,
    lastUpdated: "May 1, 2026",
    lastUpdatedAt: 20260501,
    isActive: true,
    requiredAtEnrollment: true,
    retentionYears: 7,
    body: `**Effective Date:** May 1, 2026

I acknowledge that I have been informed of the following potential side effects of GLP-1 receptor agonist therapy and contraindications to its use.

**Common Side Effects (>10% of patients)**
- Nausea, especially during dose escalation
- Decreased appetite
- Mild fatigue
- Constipation or loose stools

**Less Common but Serious Side Effects**
- Severe gastrointestinal symptoms requiring hospitalization
- Gallbladder disease (cholelithiasis)
- Acute kidney injury related to dehydration from vomiting
- Worsening of diabetic retinopathy in patients with diabetes

**Black Box Warning — Thyroid C-Cell Tumors**
GLP-1 medications have caused thyroid C-cell tumors in rodent studies. Use is contraindicated in patients with:
- Personal or family history of medullary thyroid carcinoma (MTC)
- Multiple Endocrine Neoplasia syndrome type 2 (MEN 2)

**When to Contact Your Provider Immediately**
- Severe persistent abdominal pain (with or without radiating to back)
- Signs of pancreatitis or gallbladder attack
- Persistent vomiting (>24 hours)
- Signs of severe dehydration
- Difficulty breathing or swelling (allergic reaction)
- Vision changes (if diabetic)

**My Acknowledgment**

I have read and understood the above. I have had the opportunity to ask questions. I will report any concerning side effects to my care team promptly through the patient portal or by calling (305) 555-0100.`,
  },
  {
    id: "CF-004",
    name: "Telehealth Informed Consent",
    slug: "telehealth-consent",
    category: "Telehealth",
    description: "Patient understanding of telehealth visit format, limitations, and privacy considerations.",
    version: "v2.0",
    effectiveDate: "Nov 14, 2025",
    signaturesCount: 284,
    pendingCount: 0,
    lastUpdated: "Nov 14, 2025",
    lastUpdatedAt: 20251114,
    isActive: true,
    requiredAtEnrollment: true,
    retentionYears: 7,
    body: `**Effective Date:** November 14, 2025

I consent to receive healthcare services from DripVitals via telehealth (live video and asynchronous messaging).

**Nature of Telehealth Services**
- Live video consultations using HIPAA-compliant video conferencing
- Asynchronous messaging with my care team through the patient portal
- Remote monitoring of vitals (e.g., weight, blood pressure) via patient-reported data
- Electronic prescribing to my designated pharmacy

**Limitations of Telehealth**
I understand telehealth has the following limitations:
- Physical examinations are limited to visual inspection
- Emergencies cannot be handled via telehealth — I will call 911 for emergencies
- Technical failures may interrupt or delay visits
- Some conditions require in-person evaluation

**Privacy and Confidentiality**
- All video visits use end-to-end encryption (AES-256)
- Sessions are not recorded by default; recording requires my separate explicit consent
- My provider will conduct visits from a private location
- I am responsible for my own privacy on my end of the call

**Right to Withdraw**
I may withdraw this consent at any time by notifying my care team in writing. Withdrawal will not affect care already provided.

**State of Residence**
I confirm I am physically located in a state where my provider is licensed to practice. I will notify the practice if I move to another state.`,
  },
  {
    id: "CF-005",
    name: "Financial Agreement & Payment Authorization",
    slug: "financial-agreement",
    category: "Financial",
    description: "Patient acknowledgment of fees, billing, and recurring payment authorization.",
    version: "v1.8",
    effectiveDate: "Nov 14, 2025",
    signaturesCount: 284,
    pendingCount: 0,
    lastUpdated: "Nov 14, 2025",
    lastUpdatedAt: 20251114,
    isActive: true,
    requiredAtEnrollment: true,
    retentionYears: 7,
    body: `**Effective Date:** November 14, 2025

I understand and agree to the following financial terms for services from DripVitals.

**Fees**
- Initial Consultation: $99
- Monthly subscription plans starting at $199/month
- Quarterly plans starting at $549/quarter
- Branded medications billed separately at pharmacy

**Payment Authorization**
I authorize DripVitals to charge my designated payment method on file for:
- Subscription fees on the schedule indicated by my chosen plan
- Any additional services I request
- Late fees ($25) for failed payments after 7 days

**Failed Payments**
If a payment fails:
- I will be notified by email and SMS within 24 hours
- I have 7 days to update payment information
- Service may be paused if payment is not resolved within 14 days
- Medical records remain accessible during pause period

**Cancellation**
I may cancel my subscription at any time through the patient portal or by contacting support. Cancellation is effective at the end of the current billing period. No partial refunds are issued for unused time.

**Insurance**
For patients using insurance, I authorize DripVitals to:
- Submit claims to my insurance carrier
- Receive payments directly from my insurance
- Bill me for any uncovered or denied amounts

**Disputes**
I agree to first contact DripVitals support to attempt to resolve any billing disputes before initiating a chargeback. Chargebacks without prior attempt at resolution may result in service termination.`,
  },
  {
    id: "CF-006",
    name: "Photo & Progress Tracking Consent",
    slug: "photo-progress",
    category: "Other",
    description: "Optional consent to use weight-loss progress photos for the patient's own record and provider review.",
    version: "v1.0",
    effectiveDate: "Feb 1, 2026",
    signaturesCount: 187,
    pendingCount: 3,
    lastUpdated: "Feb 1, 2026",
    lastUpdatedAt: 20260201,
    isActive: true,
    requiredAtEnrollment: false,
    retentionYears: 7,
    body: `**Effective Date:** February 1, 2026

I consent to the optional submission and storage of progress photos as part of my treatment record.

**Purpose**
- Track visible changes in body composition over time
- Support clinical assessment by my provider
- Personal record for my motivation and reflection

**Use**
Photos will be:
- Stored in encrypted form (AES-256) in my patient record
- Accessible only to my assigned care team
- Never used for marketing, advertising, or social media without separate explicit consent

**Withdrawal**
I may withdraw consent at any time. Existing photos will be deleted from active records within 30 days of withdrawal request (per HIPAA retention rules, encrypted backups may persist for up to 7 years).`,
  },
];

// Generate realistic signature audit trail (28 events)
function generateSignatures(): ConsentSignature[] {
  const patients = [
    { name: "Sarah Mitchell",   id: "PT-0041", color: "var(--color-coral)" },
    { name: "Marcus Liu",       id: "PT-0034", color: "var(--color-violet)" },
    { name: "Priya Krishnan",   id: "PT-0031", color: "var(--color-teal)" },
    { name: "Carlos Reyes",     id: "PT-0025", color: "var(--color-blue)" },
    { name: "James Thornton",   id: "PT-0052", color: "var(--color-amber)" },
    { name: "Anna Bellamy",     id: "PT-0027", color: "var(--color-purple)" },
  ];
  const events: ConsentSignature[] = [];

  const ipPool = ["73.245.91.18", "104.221.18.42", "98.156.227.4", "172.58.108.91", "76.171.42.83", "67.182.114.29"];
  const uaPool = [
    "Chrome 142 / macOS 14.4",
    "Safari 17 / iOS 17.5",
    "Chrome 142 / Windows 11",
    "Firefox 128 / Windows 11",
    "Safari 17 / macOS 14.4",
  ];

  let seq = 1;
  function nextId(): string { return `SIG-${String(seq++).padStart(4, "0")}`; }

  // The one pending: Carlos Reyes · GLP-1 Side Effects (from the source banner)
  events.push({
    id: nextId(),
    formId: "CF-003",
    formName: "GLP-1 Side Effects Acknowledgment",
    formVersion: "v1.4",
    patientName: "Carlos Reyes",
    patientId: "PT-0025",
    patientColor: "var(--color-blue)",
    status: "pending",
    sentDate: "May 26, 2026",
    sentAt: 20260526,
    reminderCount: 1,
  });

  // Recent signed events
  const signedEvents = [
    { p: patients[0], form: "CF-002", fname: "GLP-1 Treatment Informed Consent",       v: "v2.1", date: "May 28, 2026", at: 20260528 },
    { p: patients[5], form: "CF-001", fname: "HIPAA Notice of Privacy Practices",      v: "v3.2", date: "May 28, 2026", at: 20260528 },
    { p: patients[5], form: "CF-004", fname: "Telehealth Informed Consent",            v: "v2.0", date: "May 28, 2026", at: 20260528 },
    { p: patients[5], form: "CF-005", fname: "Financial Agreement & Payment Auth",     v: "v1.8", date: "May 28, 2026", at: 20260528 },
    { p: patients[2], form: "CF-003", fname: "GLP-1 Side Effects Acknowledgment",      v: "v1.4", date: "May 27, 2026", at: 20260527 },
    { p: patients[0], form: "CF-006", fname: "Photo & Progress Tracking Consent",      v: "v1.0", date: "May 25, 2026", at: 20260525 },
    { p: patients[1], form: "CF-001", fname: "HIPAA Notice of Privacy Practices",      v: "v3.2", date: "May 24, 2026", at: 20260524 },
    { p: patients[1], form: "CF-002", fname: "GLP-1 Treatment Informed Consent",       v: "v2.1", date: "May 24, 2026", at: 20260524 },
    { p: patients[1], form: "CF-003", fname: "GLP-1 Side Effects Acknowledgment",      v: "v1.4", date: "May 24, 2026", at: 20260524 },
    { p: patients[4], form: "CF-005", fname: "Financial Agreement & Payment Auth",     v: "v1.8", date: "May 22, 2026", at: 20260522 },
    { p: patients[3], form: "CF-006", fname: "Photo & Progress Tracking Consent",      v: "v1.0", date: "May 20, 2026", at: 20260520 },
    { p: patients[2], form: "CF-002", fname: "GLP-1 Treatment Informed Consent",       v: "v2.1", date: "May 19, 2026", at: 20260519 },
    { p: patients[4], form: "CF-004", fname: "Telehealth Informed Consent",            v: "v2.0", date: "May 18, 2026", at: 20260518 },
    { p: patients[0], form: "CF-003", fname: "GLP-1 Side Effects Acknowledgment",      v: "v1.4", date: "May 17, 2026", at: 20260517 },
    { p: patients[3], form: "CF-002", fname: "GLP-1 Treatment Informed Consent",       v: "v2.1", date: "May 16, 2026", at: 20260516 },
    { p: patients[2], form: "CF-004", fname: "Telehealth Informed Consent",            v: "v2.0", date: "May 15, 2026", at: 20260515 },
    { p: patients[4], form: "CF-003", fname: "GLP-1 Side Effects Acknowledgment",      v: "v1.4", date: "May 12, 2026", at: 20260512 },
    { p: patients[1], form: "CF-004", fname: "Telehealth Informed Consent",            v: "v2.0", date: "May 10, 2026", at: 20260510 },
  ];

  signedEvents.forEach((e, idx) => {
    events.push({
      id: nextId(),
      formId: e.form,
      formName: e.fname,
      formVersion: e.v,
      patientName: e.p.name,
      patientId: e.p.id,
      patientColor: e.p.color,
      status: "signed",
      sentDate: e.date,
      sentAt: e.at,
      signedDate: e.date,
      signedAt: e.at,
      ipAddress: ipPool[idx % ipPool.length],
      userAgent: uaPool[idx % uaPool.length],
      signatureMethod: "esign",
    });
  });

  // A few "sent" events that haven't been signed yet
  events.push({
    id: nextId(),
    formId: "CF-001",
    formName: "HIPAA Notice of Privacy Practices",
    formVersion: "v3.2",
    patientName: "Anna Bellamy",
    patientId: "PT-0027",
    patientColor: "var(--color-purple)",
    status: "sent",
    sentDate: "May 28, 2026",
    sentAt: 20260528,
    reminderCount: 0,
  });
  events.push({
    id: nextId(),
    formId: "CF-006",
    formName: "Photo & Progress Tracking Consent",
    formVersion: "v1.0",
    patientName: "James Thornton",
    patientId: "PT-0052",
    patientColor: "var(--color-amber)",
    status: "sent",
    sentDate: "May 27, 2026",
    sentAt: 20260527,
    reminderCount: 0,
  });

  // One voided
  events.push({
    id: nextId(),
    formId: "CF-002",
    formName: "GLP-1 Treatment Informed Consent",
    formVersion: "v1.9",  // older version superseded
    patientName: "Sarah Mitchell",
    patientId: "PT-0041",
    patientColor: "var(--color-coral)",
    status: "voided",
    sentDate: "Feb 14, 2026",
    sentAt: 20260214,
    signedDate: "Feb 14, 2026",
    signedAt: 20260214,
    ipAddress: "73.245.91.18",
    userAgent: "Chrome 141 / macOS 14.3",
    signatureMethod: "esign",
    voidReason: "Superseded by v2.1 update — patient re-signed Mar 10, 2026",
  });

  return events.sort((a, b) => {
    const aDate = a.signedAt || a.sentAt || 0;
    const bDate = b.signedAt || b.sentAt || 0;
    return bDate - aDate;
  });
}

export const CONSENT_SIGNATURES: ConsentSignature[] = generateSignatures();
