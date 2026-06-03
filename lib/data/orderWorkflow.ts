// 24-status order fulfillment workflow, grouped into 7 stages.
export type WorkflowIntent =
  | "brand" | "green" | "blue" | "amber" | "red" | "purple" | "teal" | "coral" | "pink" | "muted";

export type WorkflowStage =
  | "Intake" | "Medical Review" | "Clinical Decision" | "Payment" | "Pharmacy" | "Shipping" | "Exceptions";

export type WorkflowStatus =
  | "new_order" | "intake_incomplete" | "awaiting_questionnaire"
  | "awaiting_provider_review" | "provider_reviewing" | "additional_info_requested" | "labs_required"
  | "approved" | "denied" | "modification_requested"
  | "awaiting_payment" | "payment_failed" | "paid"
  | "ready_for_pharmacy" | "sent_to_pharmacy" | "pharmacy_processing" | "pharmacy_delayed"
  | "label_created" | "shipped" | "in_transit" | "delivered"
  | "hold" | "refund_requested" | "chargeback" | "compliance_review";

export const WORKFLOW_META: Record<WorkflowStatus, { label: string; stage: WorkflowStage; intent: WorkflowIntent }> = {
  new_order:                 { label: "New Order",                 stage: "Intake",            intent: "blue" },
  intake_incomplete:         { label: "Intake Incomplete",         stage: "Intake",            intent: "muted" },
  awaiting_questionnaire:    { label: "Awaiting Questionnaire",    stage: "Intake",            intent: "muted" },
  awaiting_provider_review:  { label: "Awaiting Provider Review",  stage: "Medical Review",    intent: "purple" },
  provider_reviewing:        { label: "Provider Reviewing",        stage: "Medical Review",    intent: "blue" },
  additional_info_requested: { label: "Additional Info Requested", stage: "Medical Review",    intent: "amber" },
  labs_required:             { label: "Labs Required",             stage: "Medical Review",    intent: "teal" },
  approved:                  { label: "Approved",                  stage: "Clinical Decision", intent: "green" },
  denied:                    { label: "Denied",                    stage: "Clinical Decision", intent: "red" },
  modification_requested:    { label: "Modification Requested",    stage: "Clinical Decision", intent: "amber" },
  awaiting_payment:          { label: "Awaiting Payment",          stage: "Payment",           intent: "amber" },
  payment_failed:            { label: "Payment Failed",            stage: "Payment",           intent: "red" },
  paid:                      { label: "Paid",                      stage: "Payment",           intent: "green" },
  ready_for_pharmacy:        { label: "Ready For Pharmacy",        stage: "Pharmacy",          intent: "teal" },
  sent_to_pharmacy:          { label: "Sent To Pharmacy",          stage: "Pharmacy",          intent: "blue" },
  pharmacy_processing:       { label: "Pharmacy Processing",       stage: "Pharmacy",          intent: "purple" },
  pharmacy_delayed:          { label: "Pharmacy Delayed",          stage: "Pharmacy",          intent: "coral" },
  label_created:             { label: "Label Created",             stage: "Shipping",          intent: "muted" },
  shipped:                   { label: "Shipped",                   stage: "Shipping",          intent: "blue" },
  in_transit:                { label: "In Transit",                stage: "Shipping",          intent: "purple" },
  delivered:                 { label: "Delivered",                 stage: "Shipping",          intent: "green" },
  hold:                      { label: "Hold",                      stage: "Exceptions",        intent: "muted" },
  refund_requested:          { label: "Refund Requested",          stage: "Exceptions",        intent: "coral" },
  chargeback:                { label: "Chargeback",                stage: "Exceptions",        intent: "red" },
  compliance_review:         { label: "Compliance Review",         stage: "Exceptions",        intent: "pink" },
};

export const WORKFLOW_STAGES: { stage: WorkflowStage; statuses: WorkflowStatus[] }[] = [
  { stage: "Intake",            statuses: ["new_order", "intake_incomplete", "awaiting_questionnaire"] },
  { stage: "Medical Review",    statuses: ["awaiting_provider_review", "provider_reviewing", "additional_info_requested", "labs_required"] },
  { stage: "Clinical Decision", statuses: ["approved", "denied", "modification_requested"] },
  { stage: "Payment",           statuses: ["awaiting_payment", "payment_failed", "paid"] },
  { stage: "Pharmacy",          statuses: ["ready_for_pharmacy", "sent_to_pharmacy", "pharmacy_processing", "pharmacy_delayed"] },
  { stage: "Shipping",          statuses: ["label_created", "shipped", "in_transit", "delivered"] },
  { stage: "Exceptions",        statuses: ["hold", "refund_requested", "chargeback", "compliance_review"] },
];

export const ALL_WORKFLOW_STATUSES: WorkflowStatus[] = WORKFLOW_STAGES.flatMap((g) => g.statuses);
