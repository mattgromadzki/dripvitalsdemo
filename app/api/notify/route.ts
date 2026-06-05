import { getTemplate, renderTemplate } from "@/lib/notify/templates";
import { sendEmail } from "@/lib/email/provider";
import { requirePerm } from "@/lib/auth/authorize";

// Notification types the PUBLIC intake form is allowed to trigger without a
// staff session (the new patient has no login yet). Everything else is a
// staff/system-triggered alert and requires the email.send permission.
const PUBLIC_TYPES = new Set(["welcome"]);

// POST { type, to, toName?, data } → render that type's template + send the email.
export async function POST(req: Request) {
  let b: { type?: string; to?: string; toName?: string; data?: Record<string, string> };
  try { b = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid body." }, { status: 400 }); }
  if (!b?.type || !b?.to) return Response.json({ ok: false, error: "type and to are required." }, { status: 400 });

  if (!PUBLIC_TYPES.has(b.type)) {
    const gate = await requirePerm(req, "email.send"); if (gate) return gate;
  }

  const tmpl = await getTemplate(b.type);
  if (!tmpl) return Response.json({ ok: false, error: "Unknown template type." }, { status: 400 });

  const data = b.data || {};
  const subject = renderTemplate(tmpl.subject, data);
  const html = renderTemplate(tmpl.html, data);
  const res = await sendEmail({ to: b.to, toName: b.toName, subject, html });
  return Response.json(res);
}
