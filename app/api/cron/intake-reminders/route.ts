import { listPending, markReminded } from "@/lib/notify/pendingIntakes";
import { getTemplate, renderTemplate } from "@/lib/notify/templates";
import { sendEmail } from "@/lib/email/provider";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

// Called by Vercel Cron (see vercel.json). Finds intakes started >24h ago that
// were never completed and never reminded, and emails the reminder once.
export async function GET(req: Request) {
  // If a CRON_SECRET is configured, require it (Vercel sends it automatically).
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const tmpl = await getTemplate("intake_reminder");
  if (!tmpl) return Response.json({ ok: false, error: "intake_reminder template missing." }, { status: 500 });

  const now = Date.now();
  const pending = await listPending();
  const due = pending.filter((p) => !p.completed && !p.remindedAt && p.email && now - p.startedAt >= DAY_MS);

  let sent = 0;
  const results: { id: string; ok: boolean }[] = [];
  for (const p of due) {
    const data = { name: p.name || "there" };
    const subject = renderTemplate(tmpl.subject, data);
    const html = renderTemplate(tmpl.html, data);
    const res = await sendEmail({ to: p.email, toName: p.name, subject, html });
    if (res.ok) { await markReminded(p.id); sent++; }
    results.push({ id: p.id, ok: !!res.ok });
  }

  return Response.json({ ok: true, checked: pending.length, due: due.length, sent, results });
}
