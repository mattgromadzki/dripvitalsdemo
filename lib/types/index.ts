export type PatientStatus = "active" | "pending" | "paused" | "churned" | "disqualified" | "unpaid" | "in_progress" | "inactive";

// Patient lifecycle stage shown on the chart header (separate from billing status).
export type LifecycleStatus =
  | "new_lead"
  | "intake_pending"
  | "awaiting_review"
  | "active_treatment"
  | "refill_due"
  | "inactive"
  | "discharged";

export interface Patient {
  id: string;
  /** Which brand this patient belongs to (separate records per brand). Absent ⇒ "dripvitals". */
  brandId?: string;
  // Identity
  first: string;
  last: string;
  name: string;
  email: string;
  phone: string;
  age: number;
  gender: "M" | "F" | "Other";
  state: string;
  status: PatientStatus;
  lifecycle?: LifecycleStatus;
  intakeProgress?: string;

  // Demographics / contact captured at intake (optional)
  dob?: string;
  address?: string;
  apt?: string;
  city?: string;
  zip?: string;
  heightIn?: number;
  goalWt?: number;
  priorGLP1?: boolean;
  transferDose?: string;

  // Program details
  plan: string;
  dose: string;
  week: number;
  provider: string;
  doctorId: number;
  pharmacyId: number;

  // Vitals
  wt: number;
  wtStart: number;
  bmi: number;
  bp: string;
  hr: number;
  a1c?: number;

  // Dates
  since: string;
  startDate: string;
  lastVisit: string;
  lastOrder: string;
  nextRefill: string;
  _refillDays: number;
  _lastOrderDays?: number;

  // Subscription / billing
  sub: string;
  allergies: string;
  tags: string[];
  notes: string;
  color: string;

  // Legal agreements captured at intake
  consents?: ConsentAcceptance[];
  clinicalFlags?: string[];        // GLP-1 relative-contraindication flags from intake screening
}

export interface ConsentAcceptance {
  docId: string;
  title: string;
  version: string;
  acceptedAt: string;  // ISO
}

export interface PatientExtra {
  dob: string;
  gender: string;
  careCoordinator: string;
  lastLogin: string;
  govId?: string;
  idVerified: boolean;
  goalWt?: number;
  streakWeeks: number;
  riskScore: number;
  riskLabel: string;
  sideEffects: { sx: string; severity: "mild" | "moderate" | "severe"; resolved: boolean; date: string }[];
  address?: { street: string; city: string; state: string; zip: string };
  insurance?: { carrier: string; memberId: string; group: string };
  emergencyContact?: { name: string; relationship: string; phone: string };
  visits: { date: string; type: string; provider: string; notes: string; duration: number }[];
  labs: { date: string; name: string; value: string; flag: "normal" | "high" | "low" | "critical"; ordered_by: string }[];
  prescriptions: { id: string; med: string; dose: string; refills: number; prescribed: string; status: "active" | "expired"; prescribedBy: string }[];
  orders: { id: string; treatmentName: string; medSub?: string; placedAt: string; qty?: string; price?: string; pharmacy: string; shipmentStatus: "placed" | "paid" | "approved" | "processing" | "shipped" | "in_transit" | "delivered"; tracking?: string; eta?: string; paid: boolean; approved: boolean; address?: string }[];
  // Phase 1B fields
  scheduledVisits: { id: string; type: string; time: string; provider: string; status: "scheduled" | "urgent" | "completed" | "no-show" }[];
  soapNotes: { id: number; type: string; date: string; status: "draft" | "signed" | "pending" }[];
  weightLog: number[];
  weightDates: string[];
  milestones: string[];
  weeklyCheckins: { week: number; nausea: number; energy: number; appetite: number; mood: number; adherence: boolean }[];
  messages: { from: string; text: string; time: string; me: boolean }[];
  supportNotes: { agent: string; date: string; note: string }[];
  invoices: { id: string; date: string; amount: string; plan: string; status: "paid" | "pending" | "failed" | "refunded" }[];
  // Phase 1C fields
  documents: { name: string; type: "Lab Report" | "Consent Form" | "ID Verification" | "Insurance" | "Progress Photo" | "Prescription"; date: string; size: string }[];
  consentHistory: { form: string; signed: string; ip: string; device: string }[];
}

export interface Visit {
  id: string;
  patientId: string;
  doctorId: number;
  type: "intake" | "follow-up" | "urgent" | "lab-review";
  date: string;
  status: "completed" | "scheduled" | "no-show" | "in-progress";
  durationMin: number;
  notes: string;
}

export type QueueStatus = "waiting" | "in_progress" | "completed" | "urgent" | "scheduled";

export interface QueueVisit {
  id: string;
  patientName: string;
  patientId?: string;       // optional — only set if patient is in the roster
  time: string;
  type: string;
  provider: string;
  reason: string;
  status: QueueStatus;
  color: string;            // avatar color
}

export interface Order {
  id: string;
  patientId: string;
  medication: string;
  dose: string;
  pharmacyId: number;
  status: "pending" | "approved" | "shipped" | "delivered" | "cancelled";
  createdAt: string;
  shippedAt?: string;
  trackingNumber?: string;
  amount: number;
}

export type RxStatusFull = "active" | "pending" | "refill" | "filled" | "denied" | "expired";

export interface Prescription {
  id: string;
  patientName: string;
  patientId?: string;
  medication: string;       // e.g. "Semaglutide"
  dose: string;             // e.g. "0.5mg weekly"
  strength: string;         // e.g. "0.5mg"
  qty: number;              // e.g. 4 units
  refillsRemaining: number;
  pharmacy: string;
  prescribedDate: string;   // display string
  prescribedAt: number;     // sortable
  prescriber: string;
  status: RxStatusFull;
  daySupply: number;        // typically 28
  sig: string;              // signa / instructions
  controlled?: boolean;     // for DEA-controlled meds (rare for GLP-1, common for ADHD)
  interactionFlag?: string; // if drug-drug check found something
}

export type SoapNoteStatus = "draft" | "signed" | "amended";

export interface SoapNote {
  id: number;
  patientName: string;
  patientId?: string;
  date: string;
  dateOrdered: number;          // sortable timestamp
  type: string;                  // e.g. "GLP-1 Check-in", "Initial Consult"
  status: SoapNoteStatus;
  provider: string;
  s: string;                     // Subjective
  o: string;                     // Objective
  a: string;                     // Assessment
  p: string;                     // Plan
  signedAt?: string;             // timestamp when signed
}

export type RxStatus = "active" | "refill" | "pending" | "filled" | "denied";
export type LabStatus = "ordered" | "in_lab" | "resulted" | "critical" | "pending";

/**
 * Aggregated order row used in /orders page (combines Rx + Lab feeds).
 * kind discriminates which kind of order this is.
 */
export interface OrderRow {
  id: string;
  kind: "rx" | "lab";
  patientName: string;
  patientId?: string;     // optional; if present we can deep-link
  item: string;           // e.g. "Semaglutide 0.5mg" or "CMP + Lipid + HbA1c"
  destination: string;    // pharmacy or lab name
  orderedDate: string;    // display string
  orderedAt: number;      // unix-like sortable timestamp (we'll synthesize)
  status: RxStatus | LabStatus;
  orderedBy: string;
  refills?: number;       // only meaningful for rx
  resultDate?: string;    // only meaningful for lab
}

export type ThreadParticipantKind = "patient" | "pharmacy" | "staff" | "system";

export interface ThreadMessage {
  from: string;
  text: string;
  time: string;
  me: boolean;
}

export interface MessageThread {
  id: number;
  from: string;                       // display name (sender)
  initials: string;
  color: string;
  kind: ThreadParticipantKind;
  patientId?: string;                 // for deep-link to chart, if applicable
  preview: string;
  time: string;                       // display
  orderedAt: number;                  // sortable
  unread: boolean;
  pinned?: boolean;
  archived?: boolean;
  thread: ThreadMessage[];
}

export type InventoryStatus = "ok" | "low" | "critical" | "on_order";
export type InventoryCategory = "GLP-1" | "IV Therapy" | "Oral" | "Injectable" | "Other";

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  pharmacy: string;
  stock: number;
  reorderAt: number;
  expires: string;
  status: InventoryStatus;
  onOrder?: number;          // qty currently in transit to top up
  lastReorderAt?: string;
  pricePerUnit?: number;
}

export type LabOrderStatus = "ordered" | "in_lab" | "resulted" | "critical" | "pending" | "cancelled";
export type LabResultFlag = "normal" | "low" | "high" | "critical";

export interface LabResultValue {
  test: string;
  value: string;
  reference: string;
  flag: LabResultFlag;
}

export interface LabPanelOrder {
  id: string;
  patientName: string;
  patientId?: string;
  panel: string;
  orderedBy: string;
  laboratory: string;
  orderedDate: string;
  orderedAt: number;
  resultedDate?: string;
  status: LabOrderStatus;
  fasting: boolean;
  priority: "routine" | "urgent" | "stat";
  notes?: string;
  results: LabResultValue[];
}

export type StaffRole = "Admin" | "Provider (MD)" | "Provider (NP)" | "Nurse" | "Care Coordinator" | "Pharmacist" | "Billing";

export interface StaffLicense {
  state: string;       // e.g. "FL"
  number: string;      // e.g. "ME12345"
  expires: string;     // e.g. "Aug 2027"
  expiresAt: number;   // sortable timestamp YYYYMMDD
}

export interface StaffMember {
  id: string;
  name: string;
  initials: string;
  role: StaffRole;
  email: string;
  phone?: string;
  npi?: string;
  dea?: string;
  states?: string;             // display string e.g. "FL, TX, CA"
  licenses: StaffLicense[];
  active: boolean;
  color: string;
  joined: string;
  lastLogin?: string;
  patientsAssigned?: number;
}

export type SecurityPolicy = {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
};

export type PharmacyConnectionStatus = "connected" | "syncing" | "error" | "paused";

export interface Pharmacy {
  id: string;
  name: string;
  icon: string;
  location: string;
  states: string;           // display, e.g. "FL, TX, CA"
  turnaround: string;       // e.g. "48h"
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  apiEndpoint?: string;     // for the API config block
  apiKey?: string;          // masked display
  connector?: "greenstone" | "emed" | "lifefile"; // which API driver transmits orders, if any
  status: PharmacyConnectionStatus;
  lastSync?: string;
  type: "compounding" | "retail" | "specialty" | "mail-order";
  monthlyOrders?: number;
  successRate?: number;     // 0-100
  avgFulfillmentDays?: number;
  contractedSince?: string;
  // ── Bask "Partner Pharmacies" admin fields (all optional, backward-compat) ──
  dba?: string;             // DBA / brand name
  npi?: string;
  ncpdp?: string;
  dea?: string;
  ein?: string;
  fax?: string;
  website?: string;
  addr?: string;            // street address
  city?: string;
  state?: string;           // single primary state code, e.g. "FL"
  zip?: string;
  statesList?: string[];    // array form of licensed states (source of truth for the picker)
  compound?: boolean;       // can compound (separate from `type === "compounding"`)
  ship?: boolean;           // ship-to-home capable
  surescripts?: boolean;
  epcs?: boolean;
  active?: boolean;         // admin "active in network" — distinct from `status` connection
  primary?: boolean;        // preferred / primary GLP-1 routing
  notes?: string;
  orders30d?: number;       // orders in last 30 days
}

export type TaskPriority = "urgent" | "high" | "normal" | "low";
export type TaskStatus = "todo" | "inprogress" | "review" | "done";
export type TaskCategory = "Lab Review" | "Consent" | "Billing" | "Follow-up" | "Prescription" | "Internal" | "Patient Care" | "Other";

export interface Task {
  id: number;
  title: string;
  description: string;
  patientName?: string;
  patientId?: string;
  assignee: string;
  assigneeColor?: string;
  priority: TaskPriority;
  due: string;          // YYYY-MM-DD
  category: TaskCategory;
  status: TaskStatus;
  createdAt: number;
  completedAt?: string;
}

export type ClaimStatus = "draft" | "submitted" | "pending" | "paid" | "denied" | "appealing";
export type PriorAuthStatus = "submitted" | "pending" | "approved" | "denied";
export type Payer = "BlueCross" | "Aetna" | "UnitedHealthcare" | "Cigna" | "Medicare" | "Medicaid" | "Self-Pay" | "Other";

export interface Claim {
  id: string;
  patientName: string;
  patientId?: string;
  payer: Payer;
  cptCode: string;          // e.g. "99214"
  serviceLabel: string;     // e.g. "Complex Office Visit"
  icd10: string;            // e.g. "E66.9, I10"
  billed: number;
  paid: number;
  patientResponsibility?: number;
  submittedDate: string;
  submittedAt: number;
  status: ClaimStatus;
  denialReason?: string;
  denialCode?: string;
  providerName: string;
  dateOfService: string;
}

export interface PriorAuth {
  id: string;
  patientName: string;
  patientId?: string;
  payer: Payer;
  medication: string;
  diagnosis: string;        // ICD-10 + description
  submittedDate: string;
  submittedAt: number;
  status: PriorAuthStatus;
  expiresOn?: string;
  daysWaiting: number;
  notes?: string;
}

export type SubscriptionStatus = "active" | "paused" | "cancelled" | "past_due" | "trial";
export type BillingCycle = "monthly" | "quarterly" | "semi-annual" | "annual";

export interface Subscription {
  id: string;
  patientName: string;
  patientId: string;
  patientColor?: string;
  plan: string;
  cycleAmount: number;       // amount charged per cycle (e.g. $549/qtr)
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  startedDate: string;
  startedAt: number;
  nextPaymentDate: string;
  nextPaymentAt: number;
  stripeId: string;          // mock Stripe subscription ID
  pausedUntil?: string;
  cancelledAt?: string;
  cancelReason?: string;
  totalPaid?: number;         // running total
  paymentsCount?: number;
}

export type NotificationCategory = "clinical" | "patient" | "staff";
export type NotificationChannel = "email" | "sms" | "push" | "in_app";

export interface NotificationRule {
  id: string;
  category: NotificationCategory;
  icon: string;
  title: string;
  description: string;
  channels: Record<NotificationChannel, boolean>;
}

export interface NotificationLogEntry {
  id: string;
  time: string;             // display
  orderedAt: number;        // sortable
  event: string;
  category: NotificationCategory | "system";
  recipient: string;
  channels: NotificationChannel[];
  status: "delivered" | "failed" | "pending";
  errorMessage?: string;
}

export interface NotificationQuietHours {
  enabled: boolean;
  startHour: number;        // 0-23
  endHour: number;          // 0-23
  exceptUrgent: boolean;    // allow critical lab values through
}

export type AuditCategory = "patient" | "auth" | "emr" | "billing" | "admin" | "security";

export interface AuditEvent {
  id: string;
  timestamp: string;        // display
  orderedAt: number;        // sortable
  user: string;             // staff name
  userColor?: string;
  category: AuditCategory;
  action: string;
  resourceType?: string;    // patient | claim | chart | etc.
  patientName?: string;
  patientId?: string;
  ipAddress: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

export type ReviewType = "GLP-1 Check-in" | "Medication Review" | "Side Effect Review" | "Labs Review" | "Initial Consult" | "Other";

export interface Review {
  id: string;
  patientName: string;
  patientId?: string;
  patientColor?: string;
  visitType: ReviewType;
  stars: 1 | 2 | 3 | 4 | 5;
  nps: number;          // 0-10
  text: string;
  date: string;          // display "May 12"
  orderedAt: number;     // sortable
  providerName?: string;
  reply?: string;
  replyAuthor?: string;
  repliedAt?: string;
  flagged?: boolean;
  flagReason?: string;
}

export type AffiliateType = "Influencer" | "Doctor" | "Health Coach" | "Podcast" | "Press" | "Affiliate Network" | "Other";
export type AffiliateStatus = "active" | "paused" | "pending" | "terminated";

export interface AffiliatePayout {
  id: string;
  date: string;          // "May 17, 2026"
  amount: number;
  period: string;        // "April 2026"
  method: "Stripe Transfer" | "PayPal" | "Wire" | "Check";
  reference: string;     // mock transaction reference
}

export interface Affiliate {
  id: string;
  name: string;
  handle: string;        // @kenziefitlife or display string
  type: AffiliateType;
  code: string;          // KENZIE50
  color: string;
  commissionRate: number; // percent
  status: AffiliateStatus;
  joinedDate: string;
  conversionsAllTime: number;
  conversions30d: number;
  revenueAllTime: number;
  revenue30d: number;
  commissionPaidAllTime: number;
  commissionPending: number;
  clickThroughs30d?: number;
  payouts: AffiliatePayout[];
  contactEmail?: string;
  cookieWindow?: number;   // days
  notes?: string;
}

export type CampaignChannel = "email" | "sms" | "both";
export type CampaignType = "Triggered" | "Recurring" | "Drip" | "One-time Blast";
export type CampaignStatus = "active" | "paused" | "draft" | "completed";

export interface Campaign {
  id: string;
  name: string;
  channel: CampaignChannel;
  type: CampaignType;
  status: CampaignStatus;
  audience: string;
  subject: string;
  sent: number;
  delivered: number;
  opens: number;
  clicks: number;
  conversions: number;
  revenue: number;
  icon: string;
  color: string;
  createdDate: string;
}

export interface Automation {
  id: string;
  name: string;
  trigger: string;
  steps: number;
  channel: string;          // display string
  status: "active" | "paused" | "draft";
  enrolled: number;
  completed: number;
  icon: string;
  color: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  channel: "Email" | "SMS";
  category: string;
  subject: string;
  preview: string;
  uses: number;
  icon: string;
  color: string;
}

export interface AudienceSegment {
  id: string;
  name: string;
  description: string;
  count: number;
  icon: string;
  color: string;
  type: "Dynamic" | "Static";
}

export type TreatmentStatus = "active" | "inactive" | "featured" | "draft";

export interface TreatmentEligibility {
  minBMI?: number;
  maxBMI?: number;
  minAge?: number;
  maxAge?: number;
  excludedConditions?: string[];
  requiredScreening?: string[];
}

export interface Treatment {
  id: string;
  name: string;
  medication: string;
  dosingProtocol: string;       // "0.25 → 1mg titration"
  duration: string;             // "3 months"
  price: number;
  billingCycle: BillingCycle;
  description: string;
  status: TreatmentStatus;
  featured: boolean;
  compounded: boolean;
  category: string;             // "GLP-1", "Weight Loss", etc.
  icon: string;
  color: string;
  activePatients: number;
  totalEnrolled: number;
  intakeFormId?: string;        // FK to IntakeForm
  eligibility: TreatmentEligibility;
  perksAndIncludes: string[];
  contraindications?: string[];
}

export type IntakeFormQuestionType = "text" | "number" | "date" | "yesno" | "single_choice" | "multiple_choice" | "section";

export interface IntakeFormQuestion {
  id: string;
  type: IntakeFormQuestionType;
  label: string;
  required: boolean;
  helpText?: string;
  options?: string[];           // for choice types
  disqualifyOn?: string[];      // answers that disqualify the patient
}

export interface IntakeForm {
  id: string;
  name: string;
  slug: string;                 // for URL
  description: string;
  status: "active" | "draft" | "archived";
  questions: IntakeFormQuestion[];
  assignedTreatmentIds: string[];
  submissionsTotal: number;
  submissionsCompleted: number;
  avgCompletionMinutes: number;
  createdDate: string;
  updatedDate: string;
}

export type KbCategory = "Clinical SOPs" | "Operations" | "Compliance" | "Billing" | "Patient FAQs" | "Integrations";

export interface KbArticle {
  id: string;
  title: string;
  slug: string;
  category: KbCategory;
  body: string;          // markdown-ish; we render as paragraphs
  author: string;
  authorColor?: string;
  updatedDate: string;
  updatedAt: number;     // sortable
  views: number;
  helpful: number;       // thumbs up count
  notHelpful: number;
  tags: string[];
  pinned: boolean;
  isPublished: boolean;
  visibility: "staff" | "patient" | "all";
}

export type ReferralStatus = "pending" | "scheduled" | "completed" | "cancelled" | "incoming" | "declined";
export type ReferralUrgency = "Routine" | "Urgent" | "STAT";
export type ReferralSpecialty = "Endocrinology" | "Cardiology" | "Gastroenterology" | "Dietitian" | "Psychiatry" | "Sleep Medicine" | "Bariatric Surgery" | "Primary Care" | "Other";

export interface Specialist {
  id: string;
  name: string;
  credentials: string;       // "MD", "DO", "RD"
  specialty: ReferralSpecialty;
  practice: string;
  city: string;
  state: string;
  phone: string;
  email?: string;
  fax?: string;
  npi: string;
  acceptingNew: boolean;
  inNetworkPayers: string[];
  avgResponseDays: number;
  totalReferralsSent: number;
  color: string;
  notes?: string;
}

export interface Referral {
  id: string;
  patientName: string;
  patientId: string;
  patientColor?: string;
  specialistId: string;
  specialistName: string;
  specialty: ReferralSpecialty;
  reason: string;
  clinicalNotes?: string;
  urgency: ReferralUrgency;
  status: ReferralStatus;
  direction: "outgoing" | "incoming";  // outgoing = we sent it, incoming = received from external
  sentDate: string;
  sentAt: number;
  scheduledDate?: string;
  completedDate?: string;
  appointmentNotes?: string;
  attachments?: string[];     // mock filenames
  authorizationRequired?: boolean;
  authStatus?: "pending" | "approved" | "denied" | "not_required";
}

export type IntegrationStatus = "connected" | "error" | "disconnected" | "configuring";
export type IntegrationCategory = "Payments" | "Communications" | "Video" | "Labs" | "Pharmacy" | "EHR" | "e-Rx" | "Analytics" | "Storage" | "Other";

export interface Integration {
  id: string;
  name: string;
  icon: string;
  color: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  description: string;
  usage?: string;        // Display string, e.g. "$47.3K/mo"
  apiKeyMasked?: string; // e.g. "sk_live_•••••••••4F2A"
  endpoint?: string;     // base URL
  webhookEndpoint?: string;
  lastSync?: string;
  errorMessage?: string;
  monthlySpend?: number;
  setupDate?: string;
  documentation?: string;
}

export interface Webhook {
  id: string;
  endpointUrl: string;
  events: string[];
  lastFired: string;
  successRate: number;     // 0-100
  totalCalls: number;
  isActive: boolean;
  secret: string;          // masked
  notes?: string;
}

export type ConsentCategory = "HIPAA" | "Treatment" | "Telehealth" | "Financial" | "Research" | "Other";
export type ConsentStatus = "signed" | "pending" | "sent" | "voided" | "expired";

export interface ConsentForm {
  id: string;
  name: string;
  slug: string;
  category: ConsentCategory;
  description: string;
  body: string;             // markdown-ish body
  version: string;          // "v2.1"
  effectiveDate: string;    // "Jan 14, 2026"
  signaturesCount: number;
  pendingCount: number;
  lastUpdated: string;
  lastUpdatedAt: number;
  isActive: boolean;
  requiredAtEnrollment: boolean;
  requiresWitness?: boolean;
  retentionYears: number;
}

export interface ConsentSignature {
  id: string;
  formId: string;
  formName: string;
  formVersion: string;
  patientName: string;
  patientId?: string;
  patientColor?: string;
  status: ConsentStatus;
  sentDate?: string;
  sentAt?: number;
  signedDate?: string;
  signedAt?: number;
  ipAddress?: string;
  userAgent?: string;
  signatureMethod?: "esign" | "wet" | "checkbox";
  witnessName?: string;
  reminderCount?: number;
  voidReason?: string;
}

export type DoctorTitle = "MD" | "DO" | "NP" | "PA" | "PharmD" | "PhD";
export type DoctorRole  = "Medical Director" | "Attending Physician" | "Associate Physician" | "Nurse Practitioner" | "Physician Assistant";

export interface DoctorStateLicense {
  state: string;       // "FL"
  number: string;      // "ME123456"
  expDate: string;     // "2026-12-31" ISO format
}

export interface Doctor {
  id: string;
  first: string;
  last: string;
  middle?: string;
  title: DoctorTitle;
  role: DoctorRole;
  email: string;
  phone: string;
  npi: string;
  dea?: string;
  boardId?: string;
  medicalSchool?: string;
  residency?: string;
  yearsExperience: number;
  gender?: "Male" | "Female" | "Other" | "";
  dob?: string;        // YYYY-MM-DD
  specialties: string[];
  active: boolean;
  epcs: boolean;
  surescripts: boolean;
  onCall: boolean;
  acceptingNew: boolean;
  maxPatients?: number;
  hoursPerWeek?: number;
  patients: number;    // current assigned
  color: string;
  licenses: DoctorStateLicense[];
}

export const US_STATES_ALL = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"] as const;

export const DOCTOR_SPECIALTIES = ["Weight Management","Endocrinology","Internal Medicine","Family Medicine","Preventive Medicine","Metabolism","Cardiology","Diabetes Care","Anti-Aging","Longevity Medicine","Sports Medicine","Psychiatry"] as const;

export type TreatmentRequestStatus = "pending" | "approved" | "denied" | "prescribed";

export interface TreatmentRequest {
  id: string;
  /** Brand the order came in through. Absent ⇒ "dripvitals". */
  brandId?: string;
  patientId: string;
  patientName: string;
  treatmentId: string;
  treatmentName: string;
  medication: string;
  dosingProtocol: string;
  duration: string;
  price: number;
  category: string;
  icon: string;
  color: string;
  // Submission context
  submittedAt: number;          // YYYYMMDDHHMM int for sorting
  submittedDate: string;        // display "May 28, 2026 · 2:14 PM"
  intakeFormId?: string;
  intakeFormName?: string;
  visitId?: string;             // optional link to the visit during which intake was filled
  // Submitted-with-form intake answer highlights (denormalized for display)
  intakeHighlights?: { label: string; value: string }[];
  clinicalFlags?: string[];     // relative contraindications flagged at intake for provider review
  // Workflow state
  status: TreatmentRequestStatus;
  approvedBy?: string;          // staff member name
  approvedAt?: number;
  approvedDate?: string;
  deniedBy?: string;
  deniedAt?: number;
  deniedReason?: string;
  prescriptionId?: string;      // link to created Rx after prescribe
  prescribedAt?: number;
  prescribedDate?: string;
  notes?: string;               // free-text clinical notes from reviewer
}

// ─── Patient-attached documents (cross-page shared) ──────────────────────
// These docs are created by the e-Prescribe workflow and surfaced in the
// patient chart's Documents tab. The full prescription payload is preserved
// so the same record can be re-rendered as a printable letterhead from
// anywhere it's referenced.
export interface PatientDocument {
  id: string;
  patientId: string;
  category: "rx" | "intake" | "lab" | "consent" | "id" | "other";
  title: string;
  icon: string;
  createdAt: number;       // YYYYMMDDHHMM int
  createdDate: string;     // display
  signedBy?: string;
  // Rx-specific snapshot (denormalized so the doc is self-contained for print/PDF)
  rxPayload?: {
    refNum: string;
    pharmacyName: string;
    pharmacyLocation?: string;
    prescriberName: string;
    prescriberNpi: string;
    prescriberDea?: string;
    patient: {
      name: string;
      id: string;
      dob: string;
      phone: string;
      email: string;
      address?: { street: string; city: string; state: string; zip: string };
      allergies: string;
      insurance?: { carrier: string; memberId: string; group: string };
    };
    medications: {
      name: string;
      drugClass: string;
      icon: string;
      strength: string;
      route: string;
      freq: string;
      qty: number;
      unit: string;
      refills: number;
      daySupply: number;
      sig: string;
      daw: boolean;
      paRequired: boolean;
      controlled: boolean;
    }[];
    supplies: {
      name: string;
      icon: string;
      qty: number;
      category: string;
      linkedToName?: string;
      notes?: string;
    }[];
    dateWritten: string;
    signedAt: string;
    signatureText: string;  // cursive provider name
  };
}

// ─── Questionnaire / Intake Form Builder ─────────────────────────────────
export type IntakeQuestionType =
  | "multiple"   // radio — pick one
  | "checkbox"   // pick all that apply (options can carry flag for logic)
  | "yesno"      // binary
  | "text"       // free text
  | "number"     // numeric input
  | "date"       // date picker
  | "scale"      // 1–10 likert
  | "section";   // section header (organizational, not a real question)

export type IntakeQuestionImpact =
  | "none"           // informational only
  | "disqualifier"   // auto-deny if triggered
  | "review"         // requires provider review
  | "qualify";       // required to proceed

export type CheckboxOptionFlag = "ok" | "review" | "disq";

export interface CheckboxOption {
  label: string;
  flag: CheckboxOptionFlag;
  tooltip?: string;
}

export interface IntakeQuestion {
  id: number;
  type: IntakeQuestionType;
  text: string;
  helper?: string;
  impact: IntakeQuestionImpact;
  disqAnswer?: string;        // displayed on the question header
  required: boolean;
  options?: (string | CheckboxOption)[];   // strings for multiple, objects for checkbox
  sectionIcon?: string;       // for section type only
}

export interface QualificationRule {
  id: string;
  icon: string;
  title: string;
  desc: string;
  active: boolean;
  // drug rules also carry a level
  level?: "disq" | "review" | "ok";
}

export interface IntakeResponseAnswers {
  name: string;
  dob: string;
  weight: string;
  height: string;
  sex: string;
  conditions: string[];
  meds: string[];
  motivation: number;
  goal: string;
}

export interface IntakeResponse {
  id: number;
  name: string;
  initials: string;
  color: string;
  date: string;
  outcome: "qualified" | "disqualified" | "review";
  bmi: number;
  flags: string[];
  disq: string | null;
  answers: IntakeResponseAnswers;
}

/* ─── Shop (patient-portal storefront catalog) ──────────────────────────
   Products managed here power the Shop tab in the patient portal. Each
   product is a marketing card whose "Get Started" button deep-links to an
   intake URL. `published` controls portal visibility; drafts stay hidden. */
export type ShopCategory = "weight" | "anti-aging" | "hair" | "sexual" | "skin";
export type ShopThumbColor = "purple" | "green" | "silver" | "blue" | "amber";

export interface ShopFaq {
  q: string;
  a: string;
}

export interface ShopProduct {
  id: string;
  name: string;
  cat: ShopCategory;
  tag: string;              // e.g. "WEIGHT LOSS · RX" — overrides the auto category label
  desc: string;             // short card description (≤120 chars, 2 lines)
  longDesc?: string;        // hero subtitle on the product detail page
  price: number;            // monthly price ($/mo) shown on the card
  firstMonth: number;       // promotional first-month price
  img: string;              // emoji/icon glyph shown in the thumbnail
  cls: ShopThumbColor;      // thumbnail background gradient
  url: string;              // intake deep-link for the Get Started button
  published: boolean;       // false === draft (hidden from portal)
  sort: number;             // ascending display order in the Shop grid
  benefits?: string[];      // bullet list on the detail page hero
  faqs?: ShopFaq[];         // accordion on the detail page
  safety?: string;          // amber safety card on the detail page
  clicks?: number;          // Get Started clicks (trailing 30 days)
}

// Shape accepted by the create/update actions — server assigns `id`.
export type ShopProductInput = Omit<ShopProduct, "id">;

// Medication catalog (pharmacy cost ledger)
export interface Medication {
  id: string;
  name: string;
  strength: string;
  program: string;
  form: string;
  pharmacy: string;
  unit: string;
  cost: number;   // price paid to the pharmacy, per unit
  ship: number;   // shipping cost, per unit
  sent: number;   // units sent out (derived from orders in production)
  status: "active" | "discontinued";
}
