import { findPatientByEmail, verifyPatientPassword, patientAuthPersistent } from "@/lib/auth/patientAccounts";
import { signPatientToken, PATIENT_COOKIE } from "@/lib/auth/patientSession";

export const dynamic = "force-dynamic";
function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

export async function POST(req: Request) {
  let b: { email?: string; password?: string; pidHint?: string; nameHint?: string };
  try { b = await req.json(); } catch { return json({ ok: false, error: "Invalid request." }, 400); }
  const email = (b.email || "").trim().toLowerCase();
  const password = b.password || "";
  if (!email || !password) return json({ ok: false, error: "Enter your email and password." });

  let pid = "", name = "Patient";
  if (patientAuthPersistent()) {
    const p = await findPatientByEmail(email);
    if (!p) return json({ ok: false, error: "No account found with that email." });
    pid = p.id; name = p.name;
  } else {
    // Demo fallback (no Upstash): trust the client-resolved id hint.
    if (!b.pidHint) return json({ ok: false, error: "No account found with that email." });
    pid = b.pidHint; name = b.nameHint || "Patient";
  }

  if (!(await verifyPatientPassword(email, password))) return json({ ok: false, error: "Incorrect password." });

  const exp = Date.now() + 1000 * 60 * 60 * 24 * 30;
  const token = signPatientToken({ pid, email, name, exp });
  const maxAge = Math.floor((exp - Date.now()) / 1000);
  const res = json({ ok: true, patient: { id: pid, name, email } });
  res.headers.append("Set-Cookie", `${PATIENT_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}`);
  return res;
}
