import crypto from "crypto";
import { listAccounts, createAccount, setRole, setActive, setPassword, unlockAccount, disableTotp, getByEmail } from "@/lib/auth/accounts";
import { verifyToken, type SessionClaims } from "@/lib/auth/serverCrypto";
import { DEFAULT_ROLE_PERMS } from "@/lib/rbac/permissions";
import { createResetToken } from "@/lib/auth/resetTokens";
import { sendEmail } from "@/lib/email/provider";
import { getEmailCreds } from "@/lib/integrations/store";
import { appendAuditEvent } from "@/lib/audit/store";

export const dynamic = "force-dynamic";

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
function origin(req: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (env) return env.replace(/\/$/, "");
  try { return new URL(req.url).origin; } catch { return "https://dripvitalsdemo.vercel.app"; }
}
function readCookie(req: Request, name: string): string | null {
  const c = req.headers.get("cookie") || "";
  const m = c.match(new RegExp("(?:^|; )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[1]) : null;
}
function session(req: Request): SessionClaims | null {
  const t = readCookie(req, "dv_session");
  return t ? verifyToken(t) : null;
}
function canManage(c: SessionClaims | null): boolean {
  return !!c && (DEFAULT_ROLE_PERMS[c.role] || []).includes("users.manage");
}

export async function GET(req: Request) {
  const c = session(req);
  if (!canManage(c)) return json({ ok: false, error: "Not authorized." }, 403);
  return json({ ok: true, accounts: await listAccounts() });
}

export async function POST(req: Request) {
  const c = session(req);
  if (!canManage(c)) return json({ ok: false, error: "Not authorized." }, 403);

  let b: { action?: string; email?: string; name?: string; role?: string; password?: string; active?: boolean };
  try { b = await req.json(); } catch { return json({ ok: false, error: "Invalid request." }, 400); }
  const email = (b.email || "").trim().toLowerCase();
  const self = c!.email.toLowerCase();

  switch (b.action) {
    case "create": {
      const res = await createAccount(email, b.name || "", b.role || "support", b.password || "");
      return json(res, res.ok ? 200 : 400);
    }
    case "invite": {
      // Create the account (if new) with an unguessable random password, then
      // email the person a one-time link to set their own password — so admins
      // never have to hand-share a temporary credential.
      const name = (b.name || "").trim();
      const role = b.role || "support";
      if (!email.includes("@")) return json({ ok: false, error: "Enter a valid email address." }, 400);
      if (!name) return json({ ok: false, error: "Enter a name." }, 400);
      const existing = await getByEmail(email);
      if (!existing) {
        const res = await createAccount(email, name, role, crypto.randomBytes(24).toString("base64url"));
        if (!res.ok) return json(res, 400);
      }
      const token = await createResetToken(email, 60 * 24 * 7); // invite link valid 7 days
      const link = `${origin(req)}/reset-password?token=${token}&email=${encodeURIComponent(email)}&welcome=1`;
      const emailConfigured = !!getEmailCreds().apiKey;
      if (emailConfigured) {
        await sendEmail({
          to: email,
          toName: name,
          subject: "You've been invited to DripVitals",
          html: `<p>Hi ${name || "there"},</p><p>An administrator has set up a DripVitals staff account for you. Set your password to get started — this link expires in 7 days and can be used once:</p><p><a href="${link}" style="display:inline-block;background:#3b7fc4;color:#fff;text-decoration:none;font-weight:700;padding:11px 22px;border-radius:8px;">Set your password</a></p><p>After setting your password, sign in at ${origin(req)}/login. If you weren't expecting this, you can ignore this email.</p>`,
        });
      }
      try { await appendAuditEvent({ action: "auth.staff_invited", actorEmail: c!.email, actorName: c!.name, actorRole: c!.role, detail: `Invited ${email} as ${role}` }); } catch { /* audit best-effort */ }
      return json({ ok: true, ...(emailConfigured ? {} : { devLink: link }) });
    }
    case "role": {
      if (email === self) return json({ ok: false, error: "You can't change your own role." }, 400);
      const ok = await setRole(email, b.role || "support");
      return json({ ok, error: ok ? undefined : "Account not found." });
    }
    case "active": {
      if (email === self && b.active === false) return json({ ok: false, error: "You can't disable your own account." }, 400);
      const ok = await setActive(email, b.active !== false);
      return json({ ok, error: ok ? undefined : "Account not found." });
    }
    case "reset": {
      if ((b.password || "").length < 8) return json({ ok: false, error: "Password must be at least 8 characters." }, 400);
      const ok = await setPassword(email, b.password!);
      return json({ ok, error: ok ? undefined : "Account not found." });
    }
    case "unlock": {
      const ok = await unlockAccount(email);
      return json({ ok, error: ok ? undefined : "Account not found." });
    }
    case "disable2fa": {
      // Recovery: an admin clears a user's 2FA if they're locked out of their authenticator.
      const ok = await disableTotp(email);
      return json({ ok, error: ok ? undefined : "Account not found." });
    }
    default:
      return json({ ok: false, error: "Unknown action." }, 400);
  }
}
