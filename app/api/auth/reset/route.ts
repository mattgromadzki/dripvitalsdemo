import { setPassword } from "@/lib/auth/accounts";

export const dynamic = "force-dynamic";

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

// Prototype password reset. In production this must require a one-time emailed token.
export async function POST(req: Request) {
  let b: { email?: string; newPassword?: string };
  try { b = await req.json(); } catch { return json({ ok: false, error: "Invalid request." }, 400); }
  const email = (b.email || "").trim().toLowerCase();
  const np = b.newPassword || "";
  if (np.length < 6) return json({ ok: false, error: "Password must be at least 6 characters." });
  const ok = await setPassword(email, np);
  return json({ ok, error: ok ? undefined : "No account found with that email." });
}
