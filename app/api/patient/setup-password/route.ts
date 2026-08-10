import { rateLimit } from "@/lib/security/ratelimit";
import { findPatientByEmail, setPatientPassword, hasPatientPassword, patientAuthPersistent } from "@/lib/auth/patientAccounts";

export const dynamic = "force-dynamic";
function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

// First-time portal password setup (intake success screen + welcome ?setpw= links).
// Only works while the account is unclaimed — once a password exists, changing it
// requires the emailed single-use token flow (/api/patient/reset/request + /confirm),
// so this can never overwrite an activated account's credentials.
export async function POST(req: Request) {
  const limited = await rateLimit(req, "reset"); if (limited) return limited;
  let b: { email?: string; password?: string };
  try { b = await req.json(); } catch { return json({ ok: false, error: "Invalid request." }, 400); }
  const email = (b.email || "").trim().toLowerCase();
  const pw = b.password || "";
  if (!email) return json({ ok: false, error: "Email is required." }, 400);
  if (pw.length < 8) return json({ ok: false, error: "Password must be at least 8 characters." });

  if (!patientAuthPersistent()) {
    return json({ ok: false, error: "Account setup isn't available right now — use the link we emailed you." }, 503);
  }
  const p = await findPatientByEmail(email);
  if (!p) return json({ ok: false, error: "We couldn't find your account yet — try again in a moment, or use the link we emailed you." }, 404);
  if (await hasPatientPassword(email)) {
    return json({ ok: false, error: "This account is already set up. Use “Forgot password?” to reset it." }, 409);
  }
  await setPatientPassword(email, pw);
  return json({ ok: true });
}
