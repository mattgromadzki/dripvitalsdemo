import { rateLimit } from "@/lib/security/ratelimit";
import { appendPatientDocument } from "@/lib/patientDocs/serverStore";
import type { PatientDocument } from "@/lib/types";

export const dynamic = "force-dynamic";

// Documents created from the PUBLIC intake form (visit packet, government ID).
// Rate-limited rather than auth-gated; staff read them via /api/store/patient-documents.
export async function POST(req: Request) {
  const limited = await rateLimit(req, "intake"); if (limited) return limited;
  let b: Partial<PatientDocument> & { patientId?: string };
  try { b = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid body." }, { status: 400 }); }
  if (!b?.patientId || !b?.category || !b?.title) {
    return Response.json({ ok: false, error: "patientId, category and title are required." }, { status: 400 });
  }
  const id = "PDOC-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const doc = { ...b, id } as PatientDocument;
  try {
    await appendPatientDocument(doc);
    return Response.json({ ok: true, id });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
