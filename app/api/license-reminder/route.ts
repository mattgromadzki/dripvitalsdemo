import { getTemplate, renderTemplate } from "@/lib/notify/templates";
import { sendEmail } from "@/lib/email/provider";
import { requirePerm } from "@/lib/auth/authorize";

export const dynamic = "force-dynamic";

// Staff-triggered "send a renewal reminder now" for a single license.
export async function POST(req: Request) {
  const gate = await requirePerm(req, "settings.manage");
  if (gate) return gate;

  const body = await req.json().catch(() => null);
  if (!body?.to) return Response.json({ ok: false, error: "Missing recipient." }, { status: 400 });

  const tmpl = await getTemplate("license_expiring");
  if (!tmpl) return Response.json({ ok: false, error: "Template missing." }, { status: 500 });

  const data = {
    name: body.toName || "Doctor",
    state: body.state || "",
    license: body.license || "—",
    expDate: body.expDate || "—",
    days: String(body.days ?? ""),
  };
  const res = await sendEmail({ to: body.to, toName: body.toName, subject: renderTemplate(tmpl.subject, data), html: renderTemplate(tmpl.html, data) });
  return Response.json({ ok: !!res.ok, error: res.ok ? undefined : (res.error || "Send failed") });
}
