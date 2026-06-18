import { rateLimit } from "@/lib/security/ratelimit";
import { findPatientByEmail, patientAuthPersistent } from "@/lib/auth/patientAccounts";
import { createResetToken } from "@/lib/auth/patientReset";
import { sendEmail } from "@/lib/email/provider";
import { getBrand } from "@/lib/brands/registry";

export const dynamic = "force-dynamic";
function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

// Emails the patient a single-use reset link. Always returns the same response
// regardless of whether the email matches an account (no account enumeration).
export async function POST(req: Request) {
  const limited = await rateLimit(req, "reset"); if (limited) return limited;
  let b: { email?: string };
  try { b = await req.json(); } catch { return json({ ok: true }); }
  const email = (b.email || "").trim().toLowerCase();

  if (email && patientAuthPersistent()) {
    const p = await findPatientByEmail(email);
    if (!p) {
      console.warn("[patient-reset] no patient matches the submitted email — nothing sent.");
    } else {
      const token = await createResetToken(email);
      if (token) {
        const base = (process.env.PATIENT_PORTAL_URL || getBrand().portalUrl || "").replace(/\/+$/, "");
        const url = `${base}?reset=${token}`;
        const firstName = (p.name || "").trim().split(/\s+/)[0] || "there";
        const html = `<div style="font-family:system-ui,-apple-system,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a;">
          <p>Hi ${firstName},</p>
          <p>We received a request to reset your DripVitals password. Choose a new one using the button below — this link expires in 30 minutes and can only be used once.</p>
          <p style="margin:20px 0;"><a href="${url}" style="background:#4a8ec7;color:#fff;padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Reset your password</a></p>
          <p style="color:#666;font-size:13px;">If you didn&rsquo;t request this, you can safely ignore this email — your password won&rsquo;t change.</p>
        </div>`;
        const res = await sendEmail({ to: email, toName: p.name, subject: "Reset your DripVitals password", html, from: process.env.EMAIL_FROM })
          .catch((e) => ({ ok: false as const, provider: "email", error: String(e) }));
        if (!res.ok) console.error("[patient-reset] email send FAILED via", res.provider, "—", res.error);
        else if (res.provider === "mock") console.warn("[patient-reset] email was MOCKED (no SENDGRID_API_KEY/RESEND_API_KEY configured) — no real email was sent.");
        else console.info("[patient-reset] reset email accepted by", res.provider);
      }
    }
  } else if (email) {
    console.warn("[patient-reset] patient auth store is not persistent (Redis not configured) — reset is disabled.");
  }
  return json({ ok: true });
}
