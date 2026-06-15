import { rateLimit } from "@/lib/security/ratelimit";
import { getByEmail } from "@/lib/auth/accounts";
import { createResetToken } from "@/lib/auth/resetTokens";
import { sendEmail } from "@/lib/email/provider";
import { getEmailCreds } from "@/lib/integrations/store";

export const dynamic = "force-dynamic";

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
function origin(req: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (env) return env.replace(/\/$/, "");
  try { return new URL(req.url).origin; } catch { return "https://dripvitalsdemo.vercel.app"; }
}

// Requests a password reset. Always returns ok (no account enumeration). When an
// account exists, a one-time token link is emailed. If no email provider is
// configured (demo), the link is returned so the flow is still testable.
export async function POST(req: Request) {
  const limited = await rateLimit(req, "reset"); if (limited) return limited;
  let b: { email?: string };
  try { b = await req.json(); } catch { return json({ ok: false, error: "Invalid request." }, 400); }
  const email = (b.email || "").trim().toLowerCase();
  if (!email.includes("@")) return json({ ok: true });

  const acct = await getByEmail(email);
  if (!acct) return json({ ok: true });

  const token = await createResetToken(email);
  const link = `${origin(req)}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
  const emailConfigured = !!getEmailCreds().apiKey;

  if (emailConfigured) {
    await sendEmail({
      to: email,
      toName: acct.name,
      subject: "Reset your DripVitals password",
      html: `<p>Hi ${acct.name || "there"},</p><p>We received a request to reset your DripVitals staff password. This link expires in 30 minutes and can be used once:</p><p><a href="${link}">Reset your password</a></p><p>If you didn't request this, you can ignore this email — your password won't change.</p>`,
    });
  }

  return json({ ok: true, ...(emailConfigured ? {} : { devLink: link }) });
}
