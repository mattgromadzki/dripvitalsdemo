import { rateLimit } from "@/lib/security/ratelimit";
import { findPatientByEmail, setPatientPassword } from "@/lib/auth/patientAccounts";
import { consumeResetToken } from "@/lib/auth/patientReset";
import { getPatientById } from "@/lib/crm/patients";
import { signPatientToken, getPatientSessionVersion, PATIENT_COOKIE } from "@/lib/auth/patientSession";

export const dynamic = "force-dynamic";
function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

// Completes a password reset using a single-use token from the emailed link.
// On success, sets the new password and signs the patient in.
export async function POST(req: Request) {
  const limited = await rateLimit(req, "reset"); if (limited) return limited;
  let b: { token?: string; password?: string };
  try { b = await req.json(); } catch { return json({ ok: false, error: "Invalid request." }, 400); }
  const token = (b.token || "").trim();
  const np = b.password || "";
  if (np.length < 8) return json({ ok: false, error: "Password must be at least 8 characters." });
  if (!token) return json({ ok: false, error: "This reset link is invalid or has expired." });

  const email = await consumeResetToken(token);
  if (!email) return json({ ok: false, error: "This reset link is invalid or has expired." });

  await setPatientPassword(email, np);

  // Auto sign-in after a successful reset.
  const p = await findPatientByEmail(email);
  if (p) {
    const exp = Date.now() + 1000 * 60 * 60 * 24 * 30;
    const tk = signPatientToken({ pid: p.id, email, name: p.name, exp, v: await getPatientSessionVersion(p.id) });
    let full = null; try { full = await getPatientById(p.id); } catch { /* ignore */ }
    const res = json({ ok: true, patient: full || { id: p.id, name: p.name, email } });
    res.headers.append("Set-Cookie", `${PATIENT_COOKIE}=${tk}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor((exp - Date.now()) / 1000)}`);
    return res;
  }
  return json({ ok: true });
}
