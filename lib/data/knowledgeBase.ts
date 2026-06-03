import type { KbArticle } from "@/lib/types";

export const KB_ARTICLES: KbArticle[] = [
  // ── Clinical SOPs ──────────────────────────────────────────────────────
  {
    id: "KB-001",
    title: "GLP-1 Dose Escalation Protocol",
    slug: "glp1-dose-escalation-protocol",
    category: "Clinical SOPs",
    author: "Dr. Sofia Rivera",
    authorColor: "var(--color-brand)",
    updatedDate: "May 8, 2026", updatedAt: 20260508,
    views: 184, helpful: 24, notHelpful: 1,
    tags: ["GLP-1", "Semaglutide", "Dosing"],
    pinned: true, isPublished: true, visibility: "staff",
    body: `Standard escalation protocol for Semaglutide.

**Weeks 1–4** — Start at 0.25 mg subcutaneous weekly. Patient should rotate injection sites between abdomen, thigh, and upper arm.

**Weeks 5–8** — Increase to 0.5 mg weekly if tolerating well. Common side effects (nausea, fatigue, headache) typically subside in this phase.

**Weeks 9–16** — Increase to 1.0 mg weekly. This is the target maintenance dose for most patients.

**Week 17 and beyond** — Consider increase to 2.4 mg weekly for patients not at goal weight.

**⚠ Do not escalate if:** Patient reports severe nausea, persistent vomiting, signs of pancreatitis (severe abdominal pain radiating to back), gallbladder symptoms, or rapid heart rate. Hold current dose and re-evaluate at next visit.`,
  },
  {
    id: "KB-002",
    title: "Handling Patient Side Effect Reports",
    slug: "side-effect-triage",
    category: "Clinical SOPs",
    author: "Dr. James Kim",
    authorColor: "var(--color-teal)",
    updatedDate: "May 1, 2026", updatedAt: 20260501,
    views: 148, helpful: 18, notHelpful: 0,
    tags: ["Triage", "Side Effects", "Escalation"],
    pinned: true, isPublished: true, visibility: "staff",
    body: `Triage matrix for incoming patient side-effect reports.

**Mild** — Nausea, fatigue, mild constipation, injection-site soreness.
Action: Document in chart, reassure patient, schedule routine follow-up. No provider page required.

**Moderate** — Persistent vomiting (>2 days), inability to keep fluids down, gallbladder symptoms.
Action: Escalate to provider within 4 hours. Provider will contact patient by EOD.

**Severe** — Chest pain, severe abdominal pain (esp. radiating to back), signs of pancreatitis, fainting, severe allergic reaction.
Action: Direct patient to call 911 immediately. Notify on-call provider within 15 minutes. Document everything.`,
  },
  {
    id: "KB-003",
    title: "BMI Threshold Documentation for Prior Auth",
    slug: "bmi-threshold-pa",
    category: "Clinical SOPs",
    author: "Dr. Sofia Rivera",
    authorColor: "var(--color-brand)",
    updatedDate: "Apr 28, 2026", updatedAt: 20260428,
    views: 96, helpful: 14, notHelpful: 1,
    tags: ["BMI", "Documentation", "Prior Auth"],
    pinned: false, isPublished: true, visibility: "staff",
    body: `For insurance prior auth, BMI documentation must include height, weight, and date — measured in the visit (not patient-reported only).

Most payers require BMI ≥30 (or ≥27 with comorbidities like DM2, HTN, sleep apnea). Use ICD-10 codes E66.9 (obesity), E66.01 (severe obesity, BMI ≥40), and any relevant comorbidity codes.

For Wegovy/Zepbound branded coverage, payers may additionally require documentation of 6 months of failed lifestyle modification or prior weight-loss medication trial.`,
  },
  {
    id: "KB-004",
    title: "Lab Panel Review Workflow",
    slug: "lab-review-workflow",
    category: "Clinical SOPs",
    author: "Denise Clark, NP",
    authorColor: "var(--color-purple)",
    updatedDate: "Apr 22, 2026", updatedAt: 20260422,
    views: 74, helpful: 11, notHelpful: 0,
    tags: ["Labs", "Review", "Provider"],
    pinned: false, isPublished: true, visibility: "staff",
    body: `Provider should review every returned lab panel within 48 business hours of receipt.

1. Open the panel in the Labs module
2. Compare results against the patient's baseline and reference ranges
3. Acknowledge any critical flags before they auto-page
4. Add a brief clinical note in the patient chart with any plan changes
5. Release results to the patient portal so they appear in their account

If the result is critical (HbA1c >9, severe electrolyte abnormality), call the patient the same day, document the call, and create a follow-up task.`,
  },
  {
    id: "KB-005",
    title: "Identifying Drug Interactions Pre-Prescribing",
    slug: "drug-interactions-pre-rx",
    category: "Clinical SOPs",
    author: "Dr. James Kim",
    authorColor: "var(--color-teal)",
    updatedDate: "Apr 15, 2026", updatedAt: 20260415,
    views: 62, helpful: 9, notHelpful: 0,
    tags: ["DDI", "Prescribing", "Safety"],
    pinned: false, isPublished: true, visibility: "staff",
    body: `Always run the DDI checker (DoseSpot integration) before signing any new Rx.

GLP-1s commonly interact with:
- **Insulin / sulfonylureas** — Risk of hypoglycemia. Reduce insulin dose 20-30% when initiating GLP-1.
- **Warfarin** — Slowed gastric emptying may affect absorption; monitor INR more frequently for 4 weeks.
- **Oral contraceptives** — Reduced absorption with delayed gastric emptying; recommend backup contraception during dose escalation.

If a critical interaction is flagged, do not override without documenting clinical rationale.`,
  },

  // ── Operations ─────────────────────────────────────────────────────────
  {
    id: "KB-006",
    title: "New Patient Onboarding Checklist",
    slug: "onboarding-checklist",
    category: "Operations",
    author: "Maria Santos",
    authorColor: "var(--color-coral)",
    updatedDate: "May 10, 2026", updatedAt: 20260510,
    views: 155, helpful: 22, notHelpful: 1,
    tags: ["Onboarding", "Checklist", "Care Coordinator"],
    pinned: true, isPublished: true, visibility: "staff",
    body: `Standard steps for every new patient enrollment.

1. Verify insurance eligibility or confirm self-pay
2. Collect complete medical history via intake form
3. Send GLP-1 intake questionnaire
4. Schedule initial consultation video visit
5. Collect signatures on 4 required consent forms (Telehealth, HIPAA, Compounded Medication, GLP-1 Side Effects)
6. Order baseline labs (HbA1c, lipid panel, CBC, TSH, CMP)
7. Route initial Rx to assigned pharmacy after provider sign-off
8. Send welcome email with portal login + first-injection video tutorial
9. Add patient to Week-2 check-in automation

Target time-to-first-dose: 7 business days from initial inquiry.`,
  },
  {
    id: "KB-007",
    title: "Refill Workflow & Auto-Renewals",
    slug: "refill-workflow",
    category: "Operations",
    author: "Nurse Chen",
    authorColor: "var(--color-amber)",
    updatedDate: "May 3, 2026", updatedAt: 20260503,
    views: 83, helpful: 12, notHelpful: 0,
    tags: ["Refills", "Pharmacy", "Workflow"],
    pinned: false, isPublished: true, visibility: "staff",
    body: `Refills are auto-triggered 14 days before the patient's medication runs out. Staff intervention required only when:
- Provider holds escalation (patient should not increase dose)
- Payment fails (Stripe webhook fires → Tasks module gets a card)
- Patient requests a change (dose, pharmacy, shipping address)

To process a manual refill: open patient chart → Orders & Rx tab → click "+ Refill". Confirm dose, pharmacy, and shipping. Provider must approve any dose changes before the order can route.`,
  },
  {
    id: "KB-008",
    title: "Pharmacy Routing Logic",
    slug: "pharmacy-routing",
    category: "Operations",
    author: "Marcus Webb",
    authorColor: "var(--color-ink-muted)",
    updatedDate: "Apr 19, 2026", updatedAt: 20260419,
    views: 47, helpful: 8, notHelpful: 0,
    tags: ["Pharmacy", "Routing", "Inventory"],
    pinned: false, isPublished: true, visibility: "staff",
    body: `Routing logic for prescriptions:

1. Match by patient state of residence (license coverage)
2. Match by medication availability at the pharmacy
3. Prefer the pharmacy with the fastest turnaround (24h > 48h > 72h)
4. Honor patient pharmacy preference if explicitly set

Manual override is available via the Rx detail modal. All overrides are audit-logged.`,
  },
  {
    id: "KB-009",
    title: "Visit Queue Triage Priorities",
    slug: "visit-queue-triage",
    category: "Operations",
    author: "Maria Santos",
    authorColor: "var(--color-coral)",
    updatedDate: "Mar 30, 2026", updatedAt: 20260330,
    views: 51, helpful: 7, notHelpful: 0,
    tags: ["Triage", "Queue", "Priority"],
    pinned: false, isPublished: true, visibility: "staff",
    body: `When provider availability is tight, prioritize visits in this order:

1. **Urgent — Side Effect** (red) — Any patient reporting severe symptoms
2. **Lab Review** — Time-sensitive (especially HbA1c trending up)
3. **Initial Consultation** — New patient revenue at risk if delayed
4. **Medication Review** — Mid-treatment escalation decisions
5. **GLP-1 Check-in** — Routine monthly visits

Avoid bumping urgent or lab-review slots unless absolutely necessary. Document any reassignments in the visit notes.`,
  },

  // ── Compliance ─────────────────────────────────────────────────────────
  {
    id: "KB-010",
    title: "HIPAA Minimum Necessary Rule",
    slug: "hipaa-minimum-necessary",
    category: "Compliance",
    author: "Marcus Webb",
    authorColor: "var(--color-ink-muted)",
    updatedDate: "Apr 30, 2026", updatedAt: 20260430,
    views: 161, helpful: 19, notHelpful: 0,
    tags: ["HIPAA", "PHI", "Privacy"],
    pinned: true, isPublished: true, visibility: "staff",
    body: `Under HIPAA's Minimum Necessary Rule, staff may only access patient PHI required for their assigned role.

**This means:**
- A care coordinator does NOT need to view full clinical SOAP notes
- Billing staff do NOT need access to mental health notes
- Marketing must work from aggregated, de-identified data only

**Unauthorized access — even out of curiosity — is a HIPAA violation.** It can trigger termination, civil penalties up to $50K per violation, and federal investigation.

Report any concerns to **compliance@dripvitals.health**. All access is logged in the Audit Log module and reviewed monthly.`,
  },
  {
    id: "KB-011",
    title: "Compounded Medication Disclosures",
    slug: "compounded-disclosures",
    category: "Compliance",
    author: "Dr. Sofia Rivera",
    authorColor: "var(--color-brand)",
    updatedDate: "Apr 18, 2026", updatedAt: 20260418,
    views: 134, helpful: 17, notHelpful: 1,
    tags: ["Compounding", "Disclosures", "FDA"],
    pinned: true, isPublished: true, visibility: "staff",
    body: `As of 2025, the FDA semaglutide shortage has ended. Mass-market compounding is generally not permitted unless patient-specific medical necessity is documented.

For each compounded prescription, the chart must document:
1. Why the FDA-approved branded drug is unsuitable (dose, allergy, formulation)
2. Provider's clinical rationale for the compounded formulation
3. Patient consent on the Compounded Medication form

Patients must receive a written disclosure that the compounded medication is not FDA-approved for weight loss.`,
  },
  {
    id: "KB-012",
    title: "Data Breach Response Plan",
    slug: "breach-response",
    category: "Compliance",
    author: "Marcus Webb",
    authorColor: "var(--color-ink-muted)",
    updatedDate: "Mar 25, 2026", updatedAt: 20260325,
    views: 67, helpful: 9, notHelpful: 0,
    tags: ["Breach", "Incident", "Response"],
    pinned: false, isPublished: true, visibility: "staff",
    body: `If you suspect a data breach:

1. **Immediately** — Notify the Privacy Officer (Marcus Webb · marcus@dripvitals.health)
2. **Within 1 hour** — Document the scope (which records, how accessed, when)
3. **Within 24 hours** — Convene incident response team; preserve all logs
4. **Within 60 days** — Notify affected patients in writing (HIPAA Breach Notification Rule)
5. **Within 60 days** — If >500 patients affected, notify HHS and prominent media in affected state

Never delete logs, emails, or files related to the suspected breach.`,
  },
  {
    id: "KB-013",
    title: "Telehealth State Licensure Requirements",
    slug: "state-licensure",
    category: "Compliance",
    author: "Marcus Webb",
    authorColor: "var(--color-ink-muted)",
    updatedDate: "Mar 14, 2026", updatedAt: 20260314,
    views: 91, helpful: 13, notHelpful: 0,
    tags: ["Licensure", "States", "Telehealth"],
    pinned: false, isPublished: true, visibility: "staff",
    body: `Providers may only see patients in states where they hold an active medical license.

The Staff & Roles module tracks each provider's license states and expiration dates. Visit Queue will block any assignment to a state the provider is not licensed in.

Annual renewals are tracked automatically. Renewal reminders fire 90 days before expiration. Failing to renew before expiration prevents any new visits — existing patients in that state must be reassigned.`,
  },

  // ── Billing ────────────────────────────────────────────────────────────
  {
    id: "KB-014",
    title: "Prior Authorization Guide",
    slug: "prior-auth-guide",
    category: "Billing",
    author: "Maria Santos",
    authorColor: "var(--color-coral)",
    updatedDate: "Apr 25, 2026", updatedAt: 20260425,
    views: 117, helpful: 15, notHelpful: 0,
    tags: ["PA", "Insurance", "Workflow"],
    pinned: true, isPublished: true, visibility: "staff",
    body: `Prior Authorization (PA) is required when the payer mandates approval before covering GLP-1 medications.

**Submit via:** Billing → Prior Auth → New PA

**Required info:**
- Patient demographics + insurance ID
- ICD-10 diagnosis (E66.9 obesity, E11.9 DM2, etc.)
- Current BMI with documentation date
- Failed alternative therapies (Metformin trial, lifestyle modification)
- Clinical rationale for compounded vs. branded

**Typical timing:** 3-5 business days. Follow up by phone if no response after 7 days.

**If denied:** Filter to denied PAs in the Billing module. Use the Appeal template. Most denials are reversed with a stronger BMI documentation packet and step-therapy proof.`,
  },
  {
    id: "KB-015",
    title: "Top Denial Codes & Resolutions",
    slug: "denial-codes",
    category: "Billing",
    author: "Marcus Webb",
    authorColor: "var(--color-ink-muted)",
    updatedDate: "Apr 11, 2026", updatedAt: 20260411,
    views: 89, helpful: 12, notHelpful: 0,
    tags: ["Denials", "Claims", "CO codes"],
    pinned: false, isPublished: true, visibility: "staff",
    body: `Common claim denial codes and how to resolve them:

**CO-11** — ICD-10 doesn't support medical necessity for CPT. Fix: Add comorbidity codes (E78.5, I10) and resubmit.

**CO-16** — Claim lacks information (often missing modifier or referring NPI). Fix: Add the required modifier and the patient's PCP NPI, resubmit.

**CO-29** — Past timely filing limit. Fix: Document any prior submission attempts; file a corrected claim with extenuating circumstances if applicable.

**CO-50** — Non-covered service per payer policy. Fix: This usually requires a benefit appeal, not a corrected claim.

**CO-97** — Payment adjusted — service is part of another procedure. Fix: Review the bundled service; if appropriate, void and re-bill.`,
  },
  {
    id: "KB-016",
    title: "Stripe Payment Disputes",
    slug: "stripe-disputes",
    category: "Billing",
    author: "Marcus Webb",
    authorColor: "var(--color-ink-muted)",
    updatedDate: "Mar 22, 2026", updatedAt: 20260322,
    views: 41, helpful: 6, notHelpful: 0,
    tags: ["Stripe", "Disputes", "Chargebacks"],
    pinned: false, isPublished: true, visibility: "staff",
    body: `When a patient files a chargeback through their bank, Stripe gives us 7 days to respond with evidence.

Required evidence package:
1. Signed Telehealth Consent showing the patient agreed to charges
2. Service delivery proof (video visit recordings or chart entries)
3. Pharmacy fulfillment proof (Rx routing logs)
4. Cancellation/refund policy acceptance
5. Patient communication history

Submit via Stripe dashboard or our integration. Track all dispute outcomes in the Subscriptions module.`,
  },

  // ── Patient FAQs ───────────────────────────────────────────────────────
  {
    id: "KB-017",
    title: "How Does Semaglutide Work?",
    slug: "how-semaglutide-works",
    category: "Patient FAQs",
    author: "Dr. Sofia Rivera",
    authorColor: "var(--color-brand)",
    updatedDate: "May 5, 2026", updatedAt: 20260505,
    views: 624, helpful: 89, notHelpful: 3,
    tags: ["Semaglutide", "Mechanism", "Education"],
    pinned: true, isPublished: true, visibility: "patient",
    body: `Semaglutide is a GLP-1 receptor agonist — it mimics your body's natural GLP-1 hormone.

**Three main effects:**
1. **Reduces appetite** — Acts on the hunger center in your brain, so you feel full sooner.
2. **Slows digestion** — Food stays in your stomach longer, making meals more satisfying.
3. **Stabilizes blood sugar** — Helps your body release insulin more efficiently after meals.

**Timeline:** Most patients begin to notice reduced cravings within 2-4 weeks. Significant weight changes typically appear at 8-12 weeks. Best results come at 16+ weeks of consistent use combined with lifestyle changes.`,
  },
  {
    id: "KB-018",
    title: "What Side Effects Should I Expect?",
    slug: "side-effects-faq",
    category: "Patient FAQs",
    author: "Denise Clark, NP",
    authorColor: "var(--color-purple)",
    updatedDate: "Apr 28, 2026", updatedAt: 20260428,
    views: 511, helpful: 72, notHelpful: 2,
    tags: ["Side Effects", "Education", "FAQ"],
    pinned: true, isPublished: true, visibility: "patient",
    body: `Most patients experience some side effects, especially in the first 4-8 weeks. These typically resolve as your body adjusts.

**Common (mild):**
- Mild nausea, especially after meals
- Reduced appetite (this is the intended effect)
- Mild fatigue or headache
- Slight constipation

**Less common:**
- More intense nausea or vomiting
- Acid reflux
- Injection-site soreness or redness

**Call us if you experience:**
- Severe abdominal pain (especially radiating to the back)
- Persistent vomiting (more than 1-2 days)
- Signs of allergic reaction (rash, swelling, breathing difficulty)
- Chest pain or rapid heart rate

We're available 24/7 through the patient portal for any concerns.`,
  },
  {
    id: "KB-019",
    title: "How Do I Inject?",
    slug: "injection-instructions",
    category: "Patient FAQs",
    author: "Nurse Chen",
    authorColor: "var(--color-amber)",
    updatedDate: "Apr 12, 2026", updatedAt: 20260412,
    views: 487, helpful: 81, notHelpful: 1,
    tags: ["Injection", "Tutorial", "Self-care"],
    pinned: false, isPublished: true, visibility: "patient",
    body: `Step-by-step injection instructions.

1. **Wash hands** with soap and water
2. **Choose a site** — Abdomen (2+ inches from navel), thigh, or upper arm. Rotate sites each week.
3. **Clean the site** with an alcohol swab. Let it air-dry completely.
4. **Pinch the skin** gently to create a small fold
5. **Insert the needle** straight in (90° angle) all the way
6. **Push the plunger** slowly and steadily until empty
7. **Remove the needle** straight out, then release the skin
8. **Dispose** of the needle in your sharps container (no exceptions)

Best time to inject: Same day each week, ideally evening before bed so you sleep through any initial nausea.

A video tutorial is available in your patient portal.`,
  },
  {
    id: "KB-020",
    title: "Can I Pause My Subscription?",
    slug: "pause-subscription",
    category: "Patient FAQs",
    author: "Maria Santos",
    authorColor: "var(--color-coral)",
    updatedDate: "Mar 31, 2026", updatedAt: 20260331,
    views: 348, helpful: 47, notHelpful: 4,
    tags: ["Subscription", "Billing", "Pause"],
    pinned: false, isPublished: true, visibility: "patient",
    body: `Yes! You can pause your subscription anytime through your patient portal or by messaging your care team.

**While paused:**
- No charges occur
- No new shipments arrive
- Your medical record stays active
- You retain access to messages with your provider

**Resuming:** Most patients restart at their last dose if it's been less than 4 weeks. If you've been off for longer, your provider may recommend re-titrating from a lower dose to reduce side effects.

Note: Insurance prior authorizations may need to be renewed if you've been off treatment for >90 days.`,
  },
  {
    id: "KB-021",
    title: "How Long Until I See Results?",
    slug: "timeline-faq",
    category: "Patient FAQs",
    author: "Dr. Sofia Rivera",
    authorColor: "var(--color-brand)",
    updatedDate: "Mar 15, 2026", updatedAt: 20260315,
    views: 412, helpful: 58, notHelpful: 2,
    tags: ["Timeline", "Expectations", "Education"],
    pinned: false, isPublished: true, visibility: "patient",
    body: `Realistic expectations help. Here's what most patients see:

**Weeks 1-4** (starting dose 0.25mg): Reduced cravings and slightly smaller portions. Most people lose 2-4 pounds.

**Weeks 5-8** (0.5mg): Noticeable appetite reduction. 4-7 pounds total.

**Weeks 9-16** (1.0mg): The "transformation phase." 10-16 pounds total. Energy improves, sleep often improves.

**Months 4-6**: Continued steady loss. Most patients reach 12-15% body weight reduction by month 6.

Individual results vary based on starting weight, lifestyle, dose tolerance, and consistency. Sticking with the program (including check-ins and labs) is the best predictor of success.`,
  },

  // ── Integrations ───────────────────────────────────────────────────────
  {
    id: "KB-022",
    title: "DoseSpot e-Prescribing Setup",
    slug: "dosespot-setup",
    category: "Integrations",
    author: "Marcus Webb",
    authorColor: "var(--color-ink-muted)",
    updatedDate: "Mar 28, 2026", updatedAt: 20260328,
    views: 34, helpful: 5, notHelpful: 0,
    tags: ["DoseSpot", "EPCS", "DEA"],
    pinned: false, isPublished: true, visibility: "staff",
    body: `DoseSpot is our EPCS-certified e-prescribing integration. Provider setup steps:

1. Provider creates a DoseSpot account at dosespot.com
2. Provider completes EPCS identity proofing (~10 minutes)
3. Two-factor token issued (hardware fob or mobile app)
4. Admin links DoseSpot account to provider profile in Staff & Roles
5. Provider does a test prescription on a test patient
6. Production access activates after first successful test transmission

Required for controlled-substance prescribing. Not strictly required for compounded GLP-1s but recommended.`,
  },
  {
    id: "KB-023",
    title: "Stripe Webhook Configuration",
    slug: "stripe-webhooks",
    category: "Integrations",
    author: "Marcus Webb",
    authorColor: "var(--color-ink-muted)",
    updatedDate: "Feb 28, 2026", updatedAt: 20260228,
    views: 28, helpful: 4, notHelpful: 0,
    tags: ["Stripe", "Webhooks", "Billing"],
    pinned: false, isPublished: true, visibility: "staff",
    body: `Stripe webhooks should be configured to send the following events to our endpoint at /webhooks/stripe:

- invoice.payment_succeeded
- invoice.payment_failed
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted
- charge.dispute.created

Verify the webhook signing secret in Stripe dashboard matches the value in our integrations panel. If signatures don't match, all events are rejected (logged in Audit Log).`,
  },
  {
    id: "KB-024",
    title: "LabCorp API Troubleshooting",
    slug: "labcorp-troubleshooting",
    category: "Integrations",
    author: "Marcus Webb",
    authorColor: "var(--color-ink-muted)",
    updatedDate: "May 22, 2026", updatedAt: 20260522,
    views: 19, helpful: 3, notHelpful: 0,
    tags: ["LabCorp", "Error", "API"],
    pinned: false, isPublished: true, visibility: "staff",
    body: `If LabCorp integration shows "error" status:

1. Check the API key expiration in Integrations → LabCorp → Configuration
2. Verify the account number is still active on LabCorp's portal
3. Test connectivity with a manual lab order (one patient, simple panel)
4. If still failing, file a ticket with LabCorp Integration Support (ticket@labcorp.com)
5. Document the incident in Audit Log → Integrations category

While LabCorp is down, route new lab orders to Quest as a fallback.`,
  },
];
