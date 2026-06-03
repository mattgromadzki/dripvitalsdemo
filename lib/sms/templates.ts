export interface SmsTemplate { id: string; name: string; body: string }
// Short SMS bodies. {{firstName}} {{med}} {{nextRefill}} {{clinic}} substituted.
export const SMS_TEMPLATES: SmsTemplate[] = [
  { id: "welcome", name: "Welcome", body: "Welcome to {{clinic}}, {{firstName}}! Reply here anytime with questions about your treatment." },
  { id: "appt", name: "Visit reminder", body: "Hi {{firstName}}, this is {{clinic}}. Reminder about your upcoming check-in. Reply C to confirm." },
  { id: "shipped", name: "Order shipped", body: "{{clinic}}: your order has shipped! Track it anytime in your patient portal." },
  { id: "refill", name: "Refill due", body: "Hi {{firstName}}, your {{med}} refill is due around {{nextRefill}}. We'll ship automatically." },
  { id: "payment", name: "Payment received", body: "{{clinic}}: we've received your payment — thank you! Your receipt is in the portal." },
];
export function applySmsTemplate(t: SmsTemplate, vars: Record<string, string>): string {
  return t.body.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}
