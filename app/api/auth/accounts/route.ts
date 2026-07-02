import { listAccounts, createAccount, setRole, setActive, setPassword, unlockAccount, disableTotp } from "@/lib/auth/accounts";
import { verifyToken, type SessionClaims } from "@/lib/auth/serverCrypto";
import { DEFAULT_ROLE_PERMS } from "@/lib/rbac/permissions";

export const dynamic = "force-dynamic";

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
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
