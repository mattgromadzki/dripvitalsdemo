import QRCode from "qrcode";
import { getSession } from "@/lib/auth/authorize";
import { getByEmail, beginTotp, confirmTotp, disableTotp, consumeBackupCode } from "@/lib/auth/accounts";
import { hashPassword, verifyPassword } from "@/lib/auth/serverCrypto";
import { generateSecret, otpauthUrl, verifyTotp, generateBackupCodes, normalizeBackupCode } from "@/lib/auth/totp";

export const dynamic = "force-dynamic";

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

// Status — is 2FA enabled for the signed-in user?
export async function GET(req: Request) {
  const s = getSession(req);
  if (!s) return json({ ok: false, error: "Sign in required." }, 401);
  const acct = await getByEmail(s.email);
  return json({ ok: true, enabled: !!acct?.totpSecret, pending: !!acct?.totpPending });
}

export async function POST(req: Request) {
  const s = getSession(req);
  if (!s) return json({ ok: false, error: "Sign in required." }, 401);
  const email = s.email;
  let b: { action?: string; code?: string; password?: string };
  try { b = await req.json(); } catch { return json({ ok: false, error: "Invalid request." }, 400); }

  const acct = await getByEmail(email);
  if (!acct) return json({ ok: false, error: "Account not found." }, 404);

  switch (b.action) {
    case "begin": {
      // Fresh secret each time enrollment starts; stored as pending until confirmed.
      const secret = generateSecret();
      await beginTotp(email, secret);
      const url = otpauthUrl(secret, email);
      const qr = await QRCode.toDataURL(url, { margin: 1, width: 220 });
      return json({ ok: true, secret, otpauthUrl: url, qr });
    }
    case "confirm": {
      if (!acct.totpPending) return json({ ok: false, error: "Start setup again — no pending enrollment." });
      if (!verifyTotp(acct.totpPending, (b.code || "").trim())) return json({ ok: false, error: "That code didn't match. Check your authenticator and try again." });
      const codes = generateBackupCodes();
      const hashed = codes.map((c) => hashPassword(normalizeBackupCode(c)));
      await confirmTotp(email, hashed);
      return json({ ok: true, backupCodes: codes }); // shown once
    }
    case "disable": {
      if (!acct.totpSecret) return json({ ok: true }); // already off
      const code = (b.code || "").trim();
      const byCode = code && (verifyTotp(acct.totpSecret, code) || await consumeBackupCode(email, normalizeBackupCode(code)));
      const byPwd = b.password && verifyPassword(b.password, acct.pwd);
      if (!byCode && !byPwd) return json({ ok: false, error: "Enter a current authenticator code or your password to turn off 2FA." });
      await disableTotp(email);
      return json({ ok: true });
    }
    default:
      return json({ ok: false, error: "Unknown action." }, 400);
  }
}
