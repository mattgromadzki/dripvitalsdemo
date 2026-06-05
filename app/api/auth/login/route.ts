import { getByEmail } from "@/lib/auth/accounts";
import { verifyPassword, signToken } from "@/lib/auth/serverCrypto";

export const dynamic = "force-dynamic";

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

export async function POST(req: Request) {
  let b: { email?: string; password?: string };
  try { b = await req.json(); } catch { return json({ ok: false, error: "Invalid request." }, 400); }
  const email = (b.email || "").trim().toLowerCase();
  const password = b.password || "";
  if (!email || !password) return json({ ok: false, error: "Enter your email and password." });

  const acct = await getByEmail(email);
  if (!acct) return json({ ok: false, error: "No account found with that email." });
  if (!acct.active) return json({ ok: false, error: "This account is disabled. Contact an administrator." });
  if (!verifyPassword(password, acct.pwd)) return json({ ok: false, error: "Incorrect password." });

  const exp = Date.now() + 1000 * 60 * 60 * 24 * 30; // 30 days
  const token = signToken({ email: acct.email, name: acct.name, role: acct.role, exp });
  const maxAge = Math.floor((exp - Date.now()) / 1000);
  const res = json({ ok: true, user: { email: acct.email, name: acct.name, role: acct.role } });
  res.headers.append("Set-Cookie", `dv_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}`);
  return res;
}
