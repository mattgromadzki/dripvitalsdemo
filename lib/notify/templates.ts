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
    type: "new_message",
    label: "New chat message",
    description: "Sent to a patient when the care team sends them a message.",
    placeholders: ["name", "message"],
    subject: "New message from your DripVitals care team",
    html: shell("You have a new message", `
    <p style="font-size:14px;line-height:1.5;">Hi {{name}}, your DripVitals care team just sent you a message:</p>
    <blockquote style="margin:12px 0;padding:12px 14px;background:#f3f5f9;border-left:3px solid #1f8a70;border-radius:6px;font-size:14px;">{{message}}</blockquote>
    <p style="font-size:14px;">Open your patient portal to read it and reply.</p>`),
  },
  order_status: {
    type: "order_status",
    label: "Order status update",
    description: "Sent to a patient when their order status changes (e.g., sent to pharmacy).",
    placeholders: ["name", "orderId", "medication", "status"],
    subject: "Update on your DripVitals order",
    html: shell("Order update", `
    <p style="font-size:14px;line-height:1.5;">Hi {{name}}, there's an update on your DripVitals order.</p>
    <p style="font-size:14px;"><b>Order {{orderId}}</b> &middot; {{medication}}<br/>Status: <b style="color:#166b57;">{{status}}</b></p>
    <p style="font-size:14px;">Track your treatment anytime in your patient portal.</p>`),
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
