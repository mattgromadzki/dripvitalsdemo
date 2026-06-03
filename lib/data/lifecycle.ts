import type { LifecycleStatus, Patient } from "@/lib/types";

export const LIFECYCLE_META: Record<LifecycleStatus, { label: string; tone: string }> = {
  new_lead:         { label: "New Lead",                 tone: "var(--color-blue)" },
  intake_pending:   { label: "Intake Pending",           tone: "var(--color-amber)" },
  awaiting_review:  { label: "Awaiting Provider Review", tone: "var(--color-purple)" },
  active_treatment: { label: "Active Treatment",         tone: "var(--color-green)" },
  refill_due:       { label: "Refill Due",               tone: "var(--color-coral)" },
  inactive:         { label: "Inactive",                 tone: "var(--color-ink-muted-2)" },
  discharged:       { label: "Discharged",               tone: "var(--color-red)" },
};

export const LIFECYCLE_ORDER: LifecycleStatus[] = [
  "new_lead", "intake_pending", "awaiting_review", "active_treatment", "refill_due", "inactive", "discharged",
];

// Pill component intents for each lifecycle stage (used by list/badge UIs).
export const LIFECYCLE_INTENT: Record<LifecycleStatus, "blue" | "amber" | "purple" | "green" | "coral" | "muted" | "red"> = {
  new_lead: "blue", intake_pending: "amber", awaiting_review: "purple",
  active_treatment: "green", refill_due: "coral", inactive: "muted", discharged: "red",
};

// Derive a lifecycle stage from existing patient data when one isn't explicitly set.
export function deriveLifecycle(p: Patient): LifecycleStatus {
  if (p.lifecycle) return p.lifecycle;
  switch (p.status) {
    case "active":        return (p._refillDays ?? 99) <= 0 ? "refill_due" : "active_treatment";
    case "pending":       return "intake_pending";
    case "unpaid":        return "intake_pending";
    case "in_progress":   return "awaiting_review";
    case "paused":        return "inactive";
    case "inactive":      return "inactive";
    case "churned":       return "discharged";
    case "disqualified":  return "discharged";
    default:              return "new_lead";
  }
}
