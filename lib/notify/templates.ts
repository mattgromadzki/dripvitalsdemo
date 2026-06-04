import { Redis } from "@upstash/redis";

/**
 * Per-notification-type email templates. Stored in Upstash so a custom template
 * applies no matter which device triggers the alert. Each template is full HTML
 * with {{placeholders}} that get filled at send time.
 */
export interface EmailTemplate {
  type: string; label: string; description: string;
  placeholders: string[]; subject: string; html: string;
}

const shell = (title: string, body: string) => `<!DOCTYPE html>
<html><body style="margin:0;background:#f5f7fb;font-family:Inter,Arial,sans-serif;color:#1b2330;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="font-size:22px;font-weight:800;color:#166b57;">DripVitals</div>
    <div style="height:3px;width:46px;background:#1f8a70;border-radius:2px;margin:6px 0 18px;"></div>
    <h1 style="font-size:18px;margin:0 0 12px;">${title}</h1>
    ${body}
    <div style="margin-top:24px;font-size:12px;color:#9aa6b8;border-top:1px solid #e6e9ef;padding-top:14px;">
      You're receiving this because you have a DripVitals account. Automated message — please don't reply.
    </div>
  </div>
</body></html>`;

const DEFAULTS: Record<string, EmailTemplate> = {
  new_message: {
    type: "new_message", label: "New chat message",
    description: "Sent to a patient when the care team sends them a message.",
    placeholders: ["name", "message"],
    subject: "New message from your DripVitals care team",
    html: shell("You have a new message", `
    <p style="font-size:14px;line-height:1.5;">Hi {{name}}, your DripVitals care team just sent you a message:</p>
    <blockquote style="margin:12px 0;padding:12px 14px;background:#f3f5f9;border-left:3px solid #1f8a70;border-radius:6px;font-size:14px;">{{message}}</blockquote>
    <p style="font-size:14px;">Open your patient portal to read it and reply.</p>`),
  },
  welcome: {
    type: "welcome", label: "Welcome (account created)",
    description: "Sent when a patient account is created.",
    placeholders: ["name"],
    subject: "Welcome to DripVitals",
    html: shell("Welcome to DripVitals", `
    <p style="font-size:14px;line-height:1.5;">Hi {{name}}, welcome to DripVitals! Your account has been created.</p>
    <p style="font-size:14px;line-height:1.5;">Our care team is reviewing your information. You can sign in to your patient portal anytime to message your provider, track your treatment, and manage your account.</p>
    <p style="font-size:14px;">We're glad you're here.</p>`),
  },
  intake_reminder: {
    type: "intake_reminder", label: "Intake reminder (24h)",
    description: "Sent when the intake questionnaire isn't completed within 24 hours.",
    placeholders: ["name"],
    subject: "Please finish your DripVitals questionnaire",
    html: shell("Finish your questionnaire", `
    <p style="font-size:14px;line-height:1.5;">Hi {{name}}, we noticed you haven't finished your DripVitals intake questionnaire yet.</p>
    <p style="font-size:14px;line-height:1.5;"><b>Your treatment can't begin until the questionnaire is complete</b>, so please take a couple of minutes to finish it.</p>
    <p style="font-size:14px;">Open your patient portal to pick up where you left off.</p>`),
  },
  approval: {
    type: "approval", label: "Provider approval (congratulations)",
    description: "Sent when a provider approves the patient's treatment.",
    placeholders: ["name", "treatment"],
    subject: "Congratulations — you've been approved",
    html: shell("You're approved! 🎉", `
    <p style="font-size:14px;line-height:1.5;">Congratulations {{name}}! Your provider has reviewed your information and <b>approved</b> your treatment{{treatment}}.</p>
    <p style="font-size:14px;line-height:1.5;">Next, we'll prepare your prescription and coordinate with the pharmacy. We'll email you each step of the way.</p>
    <p style="font-size:14px;">You can view the details anytime in your patient portal.</p>`),
  },
  rx_pharmacy: {
    type: "rx_pharmacy", label: "Prescription sent to pharmacy",
    description: "Sent when the prescription is approved and sent to the pharmacy.",
    placeholders: ["name", "medication", "pharmacy"],
    subject: "Your prescription has been approved",
    html: shell("Prescription approved", `
    <p style="font-size:14px;line-height:1.5;">Good news {{name}} — your prescription{{medication}} has been approved and sent to {{pharmacy}}.</p>
    <p style="font-size:14px;line-height:1.5;"><b>Pharmacy processing has begun.</b> You'll get another email once your order is being prepared for shipment.</p>`),
  },
  order_processing: {
    type: "order_processing", label: "Order processing",
    description: "Sent when the order is being prepared / status advances.",
    placeholders: ["name", "orderId", "status"],
    subject: "Your DripVitals order is being prepared",
    html: shell("Your order is being prepared", `
    <p style="font-size:14px;line-height:1.5;">Hi {{name}}, your order {{orderId}} is now being prepared.</p>
    <p style="font-size:14px;">Current status: <b style="color:#166b57;">{{status}}</b>. We'll keep you posted as it ships.</p>`),
  },
  shipment: {
    type: "shipment", label: "Shipment notification (shipped)",
    description: "Sent when the order ships — includes tracking number and delivery estimate.",
    placeholders: ["name", "carrier", "tracking", "eta", "orderId"],
    subject: "Your DripVitals order has shipped",
    html: shell("Your order is on the way 📦", `
    <p style="font-size:14px;line-height:1.5;">Hi {{name}}, good news — your DripVitals order {{orderId}} has shipped.</p>
    <table style="font-size:14px;margin:10px 0;"><tr><td style="padding:3px 12px 3px 0;color:#6b7890;">Carrier</td><td><b>{{carrier}}</b></td></tr>
    <tr><td style="padding:3px 12px 3px 0;color:#6b7890;">Tracking #</td><td><b>{{tracking}}</b></td></tr>
    <tr><td style="padding:3px 12px 3px 0;color:#6b7890;">Estimated delivery</td><td><b>{{eta}}</b></td></tr></table>
    <p style="font-size:14px;">You can track your package with the carrier using the number above.</p>`),
  },
  delivered: {
    type: "delivered", label: "Delivered confirmation",
    description: "Sent when the package is delivered — includes storage instructions.",
    placeholders: ["name", "orderId"],
    subject: "Your DripVitals order has been delivered",
    html: shell("Your order was delivered ✅", `
    <p style="font-size:14px;line-height:1.5;">Hi {{name}}, your DripVitals order {{orderId}} has been delivered.</p>
    <div style="margin:12px 0;padding:12px 14px;background:#e7f4ef;border-radius:8px;font-size:13.5px;line-height:1.5;">
      <b style="color:#166b57;">Storage instructions</b><br/>
      Refrigerate at 36–46°F (2–8°C). If refrigeration isn't available, it may be kept at room temperature (up to 86°F / 30°C) for a limited time per your medication's label. Keep in the original packaging, away from light, and do not freeze.</div>
    <p style="font-size:14px;">Questions about your medication? Message your care team in the patient portal.</p>`),
  },
  refill_10day: {
    type: "refill_10day", label: "Refill reminder — 10 days",
    description: "Sent ~10 days before the next refill is due (scheduled).",
    placeholders: ["name", "medication", "refillDate"],
    subject: "Your DripVitals refill is coming up",
    html: shell("Refill coming up in 10 days", `
    <p style="font-size:14px;line-height:1.5;">Hi {{name}}, your refill of {{medication}} is due around {{refillDate}}.</p>
    <p style="font-size:14px;">No action needed if you're on auto‑refill — we'll handle it. Otherwise, log in to confirm your next shipment so there's no gap in treatment.</p>`),
  },
  refill_5day: {
    type: "refill_5day", label: "Refill reminder — 5 days",
    description: "Sent ~5 days before the next refill is due (scheduled).",
    placeholders: ["name", "medication", "refillDate"],
    subject: "Your DripVitals refill is due soon",
    html: shell("Refill due in 5 days", `
    <p style="font-size:14px;line-height:1.5;">Hi {{name}}, just a reminder that your refill of {{medication}} is due around {{refillDate}}.</p>
    <p style="font-size:14px;">Confirm your refill in the portal to keep your treatment on schedule.</p>`),
  },
  refill_overdue: {
    type: "refill_overdue", label: "Refill overdue alert",
    description: "Sent when a refill is past due (scheduled).",
    placeholders: ["name", "medication"],
    subject: "Your DripVitals refill is overdue",
    html: shell("Your refill is overdue", `
    <p style="font-size:14px;line-height:1.5;">Hi {{name}}, our records show your refill of {{medication}} is now overdue.</p>
    <p style="font-size:14px;line-height:1.5;">Gaps in GLP‑1 treatment can affect your results. Please log in to reorder, or message your care team if anything's changed.</p>`),
  },
  checkin_30day: {
    type: "checkin_30day", label: "30-day check-in",
    description: "Sent ~30 days after starting treatment (scheduled).",
    placeholders: ["name"],
    subject: "How's your first month going?",
    html: shell("Checking in on your progress", `
    <p style="font-size:14px;line-height:1.5;">Hi {{name}}, you're about a month into your DripVitals treatment — how's it going?</p>
    <p style="font-size:14px;">Reply in your patient portal to share how you're feeling, any side effects, or questions. Your care team can adjust your plan if needed.</p>`),
  },
  payment_failed: {
    type: "payment_failed", label: "Failed payment alert",
    description: "Sent when a subscription charge is declined.",
    placeholders: ["name", "amount", "plan"],
    subject: "Action needed: payment issue on your DripVitals subscription",
    html: shell("We couldn't process your payment", `
    <p style="font-size:14px;line-height:1.5;">Hi {{name}}, we tried to charge {{amount}} for your {{plan}} but the payment didn't go through.</p>
    <p style="font-size:14px;line-height:1.5;">Please update your payment method in the patient portal to avoid any interruption to your treatment. We'll automatically retry once it's updated.</p>`),
  },
  inactive_30day: {
    type: "inactive_30day", label: "Patient inactive 30 days",
    description: "Sent when a patient has had no activity for 30 days (scheduled).",
    placeholders: ["name"],
    subject: "We're here whenever you're ready",
    html: shell("We've missed you", `
    <p style="font-size:14px;line-height:1.5;">Hi {{name}}, we noticed it's been a while. Your DripVitals care team is here whenever you're ready to continue your treatment.</p>
    <p style="font-size:14px;">Log in anytime to pick back up, or message us with any questions.</p>`),
  },
};

const KEY = "email:templates:v1";
const mem: Record<string, { subject: string; html: string }> = {};

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function defaultTemplate(type: string): EmailTemplate | null { return DEFAULTS[type] ? { ...DEFAULTS[type] } : null; }
export function defaultTemplates(): EmailTemplate[] { return Object.values(DEFAULTS).map((t) => ({ ...t })); }

export async function getTemplate(type: string): Promise<EmailTemplate | null> {
  const def = DEFAULTS[type];
  if (!def) return null;
  const r = redis();
  let override: { subject?: string; html?: string } | null = null;
  if (r) {
    const v = await r.hget<string | { subject?: string; html?: string }>(KEY, type);
    if (v) override = typeof v === "string" ? JSON.parse(v) : v;
  } else if (mem[type]) {
    override = mem[type];
  }
  return { ...def, subject: override?.subject || def.subject, html: override?.html || def.html };
}

export async function listTemplates(): Promise<EmailTemplate[]> {
  const out: EmailTemplate[] = [];
  for (const type of Object.keys(DEFAULTS)) { const t = await getTemplate(type); if (t) out.push(t); }
  return out;
}

export async function saveTemplate(type: string, subject: string, html: string): Promise<boolean> {
  if (!DEFAULTS[type]) return false;
  const r = redis();
  if (r) await r.hset(KEY, { [type]: JSON.stringify({ subject, html }) });
  else mem[type] = { subject, html };
  return true;
}

export function renderTemplate(s: string, data: Record<string, string>): string {
  return s.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (data[k] != null ? String(data[k]) : ""));
}
