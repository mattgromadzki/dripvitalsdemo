import { rateLimit } from "@/lib/security/ratelimit";
import { findPatientByEmail, verifyPatientPassword, patientAuthPersistent } from "@/lib/auth/patientAccounts";
import { getPatientById, savePatient } from "@/lib/crm/patients";
import { appendAuditEvent, requestGeo } from "@/lib/audit/store";
import { signPatientToken, getPatientSessionVersion, PATIENT_COOKIE } from "@/lib/auth/patientSession";

export const dynamic = "force-dynamic";
function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

export async function POST(req: Request) {
  const limited = await rateLimit(req, "login"); if (limited) return limited;
  let b: { email?: string; password?: string; pidHint?: string; nameHint?: string };
  try { b = await req.json(); } catch { return json({ ok: false, error: "Invalid request." }, 400); }
  const email = (b.email || "").trim().toLowerCase();
  const password = b.password || "";
  if (!email || !password) return json({ ok: false, error: "Enter your email and password." });

  let pid = "", name = "Patient";
  if (patientAuthPersistent()) {
    const p = await findPatientByEmail(email);
    if (!p) { console.warn("[patient-login] no patient in the roster matches:", email); return json({ ok: false, error: "No account found with that email." }); }
    pid = p.id; name = p.name;
  } else {
    // Demo fallback (no Upstash): trust the client-resolved id hint.
    console.warn("[patient-login] patient store is NOT persistent (no DB/Redis) — relying on client id hint");
    if (!b.pidHint) return json({ ok: false, error: "No account found with that email." });
    pid = b.pidHint; name = b.nameHint || "Patient";
  }

  if (!(await verifyPatientPassword(email, password))) { console.warn("[patient-login] password mismatch for", email); return json({ ok: false, error: "Incorrect password." }); }
  console.info("[patient-login] success for", email, "→ pid", pid);

  const exp = Date.now() + 1000 * 60 * 60 * 24 * 30;
  const token = signPatientToken({ pid, email, name, exp, v: await getPatientSessionVersion(pid) });
  const maxAge = Math.floor((exp - Date.now()) / 1000);
  let full = null; try { full = await getPatientById(pid); } catch { /* ignore */ }
  // Record the sign-in: stamp the patient record (shown on the chart) and write
  // an audit event. Best-effort — must never block a login.
  const loginAt = new Date().toISOString();
  try { if (full) { full = { ...full, lastPortalLogin: loginAt }; await savePatient(full); } } catch { /* ignore */ }
  try {
    const xff = req.headers.get("x-forwarded-for");
    await appendAuditEvent({ action: "patient.login", actorEmail: email, actorName: name, actorRole: "patient", patientId: pid, ip: xff ? xff.split(",")[0].trim() : (req.headers.get("x-real-ip") || undefined) || undefined, geo: requestGeo(req) });
  } catch { /* ignore */ }
  const res = json({ ok: true, patient: full || { id: pid, name, email } });
  res.headers.append("Set-Cookie", `${PATIENT_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}`);
  return res;
}
