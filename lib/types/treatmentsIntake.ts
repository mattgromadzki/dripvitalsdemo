// Bask Treatments & Intake module — self-contained types matching the HTML 1:1.
// Kept separate from the legacy Treatment / IntakeForm types so existing
// consumers (e-Prescribe, etc.) continue to work unchanged.

export type BaskBillingCycle = "monthly" | "quarterly" | "semi-annual" | "annual" | "one-time";
export type BaskColorKey = "brand" | "blue" | "purple" | "amber" | "coral" | "teal" | "pink";

export interface BaskTreatment {
  id: number;
  name: string;
  med: string;
  strength: string;
  duration: string;          // "1" | "3" | "6" | "12"
  billing: BaskBillingCycle;
  price: string;             // "$499"
  compare: string;           // "$747" or ""
  desc: string;
  icon: string;
  color: BaskColorKey;
  active: boolean;
  compounded: boolean;
  featured: boolean;
  subscribers: number;
  includes: string[];
  pharmacy: string;
  freq: string;
  // Base64-encoded data URL of the product image. Compressed on upload to
  // keep localStorage size manageable. Optional — when absent the UI falls
  // back to the emoji `icon` + color theme.
  thumbnail?: string;
}

export type BaskQuestionType =
  | "section" | "text" | "long_text" | "number" | "date"
  | "yesno"   | "multiple" | "checkbox" | "dropdown" | "scale" | "rating"
  | "email"   | "phone"    | "address"  | "state" | "signature" | "file"
  | "bmi" | "personal_info";

export type BaskOptionFlag = "ok" | "review" | "disq";
export interface BaskCheckboxOption { label: string; flag: BaskOptionFlag; }
export type BaskOption = string | BaskCheckboxOption;

export type BaskImpact = "none" | "disqualifier" | "review" | "qualify";

export interface BaskQuestion {
  id: number;
  type: BaskQuestionType;
  text: string;
  helper: string;
  impact: BaskImpact;
  required: boolean;
  options?: BaskOption[];
  sectionIcon?: string;
}

export interface BaskRule {
  id: string;
  icon: string;
  title: string;
  desc: string;
  active: boolean;
  level?: "disq" | "review" | "ok";
}

export interface BaskFormSettings {
  applies: string;             // "All GLP-1 Treatments" etc.
  autoMode: "ai_review" | "automated" | "manual";
  submissionLimitPerPatient: string;  // "Unlimited" | "1" | "2" etc.
  autoCloseAfter: string;      // "Off" | "100 submissions" etc.
  strictValidation: boolean;
}

export interface BaskFormNotifications {
  qualifyEmail: string;
  disqualifyEmail: string;
  reviewEmail: string;
  patientConfirmationEnabled: boolean;
}

export interface BaskIntakeForm {
  id: number;
  name: string;
  slug: string;
  desc: string;
  active: boolean;
  treatmentIds: number[];
  submissions: number;
  qualified: number;
  questions: BaskQuestion[];
  // Optional per-form configurations. Old persisted forms may not have these;
  // the editor reads them with safe defaults if absent.
  hardRules?: BaskRule[];
  drugRules?: BaskRule[];
  reviewRules?: BaskRule[];
  settings?: BaskFormSettings;
  notifications?: BaskFormNotifications;
  /** Optional custom heading/note for the treatment-selection step — used by
   *  brand-bridge forms (e.g. Ozempic®) to introduce the compounded equivalent. */
  txScreenTitle?: string;
  txScreenNote?: string;
}

export type BaskClientStatus =
  | "in_progress" | "disqualified" | "unpaid" | "paid" | "refunded";

export interface BaskAddress {
  line1: string; apt: string; city: string; state: string; zip: string;
}
export interface BaskReminder { at: string; channel: string; }

export interface BaskClient {
  id: number;
  first: string;
  last: string;
  email: string;
  phone: string;
  formId: number;
  formName: string;
  formSlug: string;
  treatmentId: number | null;
  status: BaskClientStatus;
  startedAt: string;
  paidAt: string | null;
  address: BaskAddress;
  lastFour: string | null;
  cardBrand: string | null;
  reminders: BaskReminder[];
  answers: Record<number, string | number | string[]>;
  disqReason?: string;
}
