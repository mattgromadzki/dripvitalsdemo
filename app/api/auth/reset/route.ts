import { rateLimit } from "@/lib/security/ratelimit";
import { setPassword } from "@/lib/auth/accounts";
import { consumeResetToken } from "@/lib/auth/resetTokens";

export const dynamic = "force-dynamic";

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

// Sets a new password — only with a valid, unexpired, single-use reset token.
export async function POST(req: Request) {
  const limited = await rateLimit(req, "reset"); if (limited) return limited;
  let b: { email?: string; token?: string; newPassword?: string };
  try { b = await req.json(); } catch { return json({ ok: false, error: "Invalid request." }, 400); }
  const email = (b.email || "").trim().toLowerCase();
  const token = (b.token || "").trim();
  const np = b.newPassword || "";
  if (np.length < 8) return json({ ok: false, error: "Password must be at least 8 characters." });
  if (!token) return json({ ok: false, error: "This reset link is invalid or has expired." });

  const valid = await consumeResetToken(token, email);
  if (!valid) return json({ ok: false, error: "This reset link is invalid or has expired. Request a new one." });

  const ok = await setPassword(email, np);
  return json({ ok, error: ok ? undefined : "Account not found." });
}
