import { getTemplate, renderTemplate } from "@/lib/notify/templates";
import { sendEmail } from "@/lib/email/provider";
import { loadDoctors, wasSent, markSent } from "@/lib/notify/licenseReminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmt(iso: string): string {
  const [y, m, d] = (iso || "").split("-");
  if (!y || !m || !d) return iso || "—";
  return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

// Called daily by Vercel Cron (see vercel.json). For each in-house doctor's
// state license, emails the doctor 60 days before expiry, and again 30 days
// before, unless the license has been renewed (expDate changed). De-dup is keyed
// on the expiration date so renewals stop the reminders automatically.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const tmpl = await getTemplate("license_expiring");
  if (!tmpl) return Response.json({ ok: false, error: "license_expiring template missing." }, { status: 500 });

  const doctors = await loadDoctors();
  const now = Date.now();
  let licenses = 0, sent = 0;
  const results: { doctor: string; state: string; threshold: string; ok: boolean }[] = [];

  for (const d of doctors) {
    if (d.active === false || !d.email || !Array.isArray(d.licenses)) continue;
    const name = `${d.first || ""} ${d.last || ""}`.trim() || "Doctor";

    for (const lic of d.licenses) {
      if (!lic?.expDate) continue;
      licenses++;
      const expMs = new Date(lic.expDate + "T00:00:00Z").getTime();
      if (isNaN(expMs)) continue;
      const days = Math.round((expMs - now) / DAY_MS);

      let threshold: "60" | "30" | null = null;
      if (days >= 0 && days <= 30) threshold = "30";
      else if (days > 30 && days <= 60) threshold = "60";
      if (!threshold) continue;

      const key = `${d.id}:${lic.state}:${lic.expDate}:${threshold}`;
      if (await wasSent(key)) continue;

      const data = { name, state: lic.state, license: lic.number || "—", expDate: fmt(lic.expDate), days: String(days) };
      const res = await sendEmail({ to: d.email, toName: name, subject: renderTemplate(tmpl.subject, data), html: renderTemplate(tmpl.html, data) });
      if (res.ok) { await markSent(key); sent++; }
      results.push({ doctor: name, state: lic.state, threshold, ok: !!res.ok });
    }
  }

  return Response.json({ ok: true, doctors: doctors.length, licenses, sent, results });
}
