import { findPatientByEmail, setPatientPassword, patientAuthPersistent } from "@/lib/auth/patientAccounts";

export const dynamic = "force-dynamic";
function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

// Demo password reset for patients (no emailed token yet — see note). Sets a
// hashed override when Upstash is configured; otherwise succeeds without persisting.
export async function POST(req: Request) {
  let b: { email?: string; newPassword?: string };
  try { b = await req.json(); } catch { return json({ ok: false, error: "Invalid request." }, 400); }
  const email = (b.email || "").trim().toLowerCase();
  const np = b.newPassword || "";
  if (np.length < 8) return json({ ok: false, error: "Password must be at least 8 characters." });

  if (patientAuthPersistent()) {
    const p = await findPatientByEmail(email);
    if (!p) return json({ ok: true }); // don't reveal non-existence
    await setPatientPassword(email, np);
  }
  return json({ ok: true });
}
