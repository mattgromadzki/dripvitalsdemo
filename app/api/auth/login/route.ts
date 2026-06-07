import { getByEmail, lockState, recordFailedLogin, clearLoginFailures, consumeBackupCode, LOCK_MINUTES } from "@/lib/auth/accounts";
import { verifyPassword, signToken } from "@/lib/auth/serverCrypto";
import { verifyTotp, normalizeBackupCode } from "@/lib/auth/totp";

export const dynamic = "force-dynamic";

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
const minsLeft = (until: number) => Math.max(1, Math.ceil((until - Date.now()) / 60_000));

export async function POST(req: Request) {
  let b: { email?: string; password?: string; code?: string };
  try { b = await req.json(); } catch { return json({ ok: false, error: "Invalid request." }, 400); }
  const email = (b.email || "").trim().toLowerCase();
  const password = b.password || "";
  if (!email || !password) return json({ ok: false, error: "Enter your email and password." });

  const acct = await getByEmail(email);
  if (!acct) return json({ ok: false, error: "No account found with that email." });
  if (!acct.active) return json({ ok: false, error: "This account is disabled. Contact an administrator." });

  // Lockout gate (checked before password so a locked account can't be probed).
  const lock = lockState(acct);
  if (lock.locked) return json({ ok: false, locked: true, until: lock.until, error: `Account locked after too many attempts. Try again in ${minsLeft(lock.until)} min.` });

  if (!verifyPassword(password, acct.pwd)) {
    const r = await recordFailedLogin(email);
    if (r.locked) return json({ ok: false, locked: true, until: r.until, error: `Too many attempts — account locked for ${LOCK_MINUTES} minutes.` });
    const tail = r.remaining <= 2 ? ` ${r.remaining} attempt${r.remaining === 1 ? "" : "s"} left.` : "";
    return json({ ok: false, error: `Incorrect password.${tail}` });
  }

  // Password OK — second factor, if enrolled.
  if (acct.totpSecret) {
    const code = (b.code || "").trim();
    if (!code) return json({ ok: false, twofa: true }); // prompt for the 6-digit / backup code
    const okCode = verifyTotp(acct.totpSecret, code) || await consumeBackupCode(email, normalizeBackupCode(code));
    if (!okCode) {
      const r = await recordFailedLogin(email);
      if (r.locked) return json({ ok: false, locked: true, until: r.until, error: `Too many attempts — account locked for ${LOCK_MINUTES} minutes.` });
      return json({ ok: false, twofa: true, error: "Invalid authentication code." });
    }
  }

  await clearLoginFailures(email);
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 30; // 30 days
  const token = signToken({ email: acct.email, name: acct.name, role: acct.role, exp });
  const maxAge = Math.floor((exp - Date.now()) / 1000);
  const res = json({ ok: true, user: { email: acct.email, name: acct.name, role: acct.role } });
  res.headers.append("Set-Cookie", `dv_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}`);
  return res;
}
