export interface EmailTemplate { id: string; name: string; category: string; subject: string; html: string }

// HTML bodies. {{firstName}} {{fullName}} {{med}} {{dose}} {{nextRefill}} {{clinic}} are substituted.
export const EMAIL_TEMPLATES: EmailTemplate[] = [
  { id: "welcome", name: "Welcome", category: "Onboarding",
    subject: "Welcome to {{clinic}}, {{firstName}}!",
    html: "<p>Hi {{firstName}},</p><p>Welcome to <b>{{clinic}}</b>! Your account is set up and our care team is reviewing your intake. We'll reach out shortly with next steps.</p><p>If you have any questions, just reply to this email or message us in the patient portal.</p><p>— The {{clinic}} Care Team</p>" },
  { id: "refill_reminder", name: "Refill reminder", category: "Treatment",
    subject: "Your {{med}} refill is coming up",
    html: "<p>Hi {{firstName}},</p><p>This is a friendly reminder that your <b>{{med}}</b> refill is due around <b>{{nextRefill}}</b>. No action is needed — we'll prepare your next shipment automatically.</p><p>Reply here if anything has changed with your treatment.</p><p>— {{clinic}}</p>" },
  { id: "shipment", name: "Order shipped", category: "Fulfillment",
    subject: "Your {{clinic}} order has shipped",
    html: "<p>Hi {{firstName}},</p><p>Good news — your <b>{{med}}</b> order is on its way. You'll receive tracking details shortly.</p><p>Store your medication as directed and reach out with any questions.</p><p>— {{clinic}}</p>" },
  { id: "payment_receipt", name: "Payment receipt", category: "Billing",
    subject: "Your {{clinic}} payment receipt",
    html: "<p>Hi {{firstName}},</p><p>Thank you — we've received your payment. A detailed receipt is available in your patient portal under <b>Billing</b>.</p><p>— {{clinic}}</p>" },
];

export function applyTemplate(t: EmailTemplate, vars: Record<string, string>): { subject: string; html: string } {
  const sub = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
  return { subject: sub(t.subject), html: sub(t.html) };
}
