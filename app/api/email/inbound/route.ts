import { appendInbound } from "@/lib/email/inbound";
import { htmlToPreview } from "@/lib/email/types";
import type { EmailMessage } from "@/lib/email/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function parseAddr(s: string): { name?: string; email: string } {
  const m = (s || "").match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1]?.replace(/(^"|"$)/g, "").trim() || undefined, email: m[2].trim().toLowerCase() };
  return { email: (s || "").trim().toLowerCase() };
}
function esc(s: string) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

/**
 * SendGrid Inbound Parse webhook.
 *
 * Setup: point an MX record for a dedicated subdomain (e.g. inbox.dripvitals.com)
 * at `mx.sendgrid.net`, then in SendGrid → Settings → Inbound Parse, set the
 * destination URL to this route. Email sent to that subdomain lands in the EMR's
 * Emails → Inbox folder. Optionally protect it by setting SENDGRID_INBOUND_SECRET
 * and appending `?key=<secret>` to the Parse destination URL.
 */
export async function POST(req: Request) {
  const secret = process.env.SENDGRID_INBOUND_SECRET;
  if (secret) {
    const provided = new URL(req.url).searchParams.get("key") || "";
    if (provided !== secret) return new Response("unauthorized", { status: 401 });
  }

  try {
    const form = await req.formData();
    const get = (k: string) => { const v = form.get(k); return typeof v === "string" ? v : ""; };

    const from = parseAddr(get("from"));
    const to = parseAddr(get("to")).email || get("to");
    const subject = get("subject") || "(no subject)";
    const text = get("text");
    const html = get("html") || (text ? `<p>${esc(text).replace(/\r?\n/g, "<br>")}</p>` : "<p>(empty message)</p>");

    const msg: EmailMessage = {
      id: "IN-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      folder: "inbox",
      direction: "in",
      fromName: from.name || from.email || "Unknown sender",
      fromEmail: from.email,
      to,
      subject,
      html,
      preview: htmlToPreview(html),
      status: "received",
      read: false,
      starred: false,
      createdAt: new Date().toISOString(),
    };
    await appendInbound(msg);
  } catch { /* ack anyway so SendGrid doesn't retry forever */ }

  return new Response("ok", { status: 200 });
}
