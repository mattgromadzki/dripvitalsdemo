export type Channel = "email" | "sms";
export type TriggerId = "patient_created" | "intake_submitted" | "intake_approved" | "intake_abandoned" | "order_shipped" | "payment_failed" | "subscription_canceled" | "refill_due" | "lead_added";
export interface Step { id: string; delayDays: number; channel: Channel; subject?: string; body: string; }
export interface Automation { id: string; name: string; trigger: TriggerId; enabled: boolean; steps: Step[]; createdAt: string; }
export interface RunEvent { stepId: string; channel: Channel; when: string; status: "sent" | "scheduled" | "failed" | "skipped"; at: string; detail: string; }
export interface Enrollment { id: string; automationId: string; automationName: string; recipientName: string; startedAt: string; events: RunEvent[]; }

export const TRIGGERS: { id: TriggerId; label: string; desc: string }[] = [
  { id: "patient_created", label: "New patient created", desc: "Fires when a patient account is created." },
  { id: "intake_submitted", label: "Intake submitted", desc: "Fires when a patient submits their intake." },
  { id: "intake_approved", label: "Intake approved", desc: "Fires when a provider approves an intake." },
  { id: "intake_abandoned", label: "Intake abandoned", desc: "Fires when an intake is started but not finished." },
  { id: "order_shipped", label: "Order shipped", desc: "Fires when a pharmacy order ships." },
  { id: "payment_failed", label: "Payment failed", desc: "Fires when a subscription charge fails." },
  { id: "subscription_canceled", label: "Subscription canceled", desc: "Fires when a subscription is canceled." },
  { id: "refill_due", label: "Refill due soon", desc: "Fires ahead of an upcoming refill." },
  { id: "lead_added", label: "New cold lead added", desc: "Fires when a cold lead is added or imported." },
];
export const triggerLabel = (id: TriggerId) => TRIGGERS.find((t) => t.id === id)?.label || id;
export const delayLabel = (d: number) => (d === 0 ? "Immediately" : d === 1 ? "After 1 day" : `After ${d} days`);
export function personalize(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}
