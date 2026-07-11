import { rateLimit } from "@/lib/security/ratelimit";
import { allocatePatientId } from "@/lib/crm/patients";

export const dynamic = "force-dynamic";

// Issue the next patient number, atomically, server-side. Called by the public
// intake flow (and the EMR's Add Patient) BEFORE creating a patient, so two
// browsers can never mint the same id and overwrite each other's records.
// Public because intake is public; rate-limited to prevent counter abuse
// (a skipped number costs nothing — ids just need to be unique, not dense).
export async function POST(req: Request) {
  const limited = await rateLimit(req, "intake");
  if (limited) return limited;
  try {
    const id = await allocatePatientId();
    return Response.json({ ok: true, id });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
