import { savePatient, listPatients, isPersistent } from "@/lib/crm/patients";
import type { Patient } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET → all intake-created patients (for the EMR to hydrate)
export async function GET() {
  try { return Response.json({ ok: true, persistent: isPersistent(), patients: await listPatients() }); }
  catch (e) { return Response.json({ ok: false, error: String(e), patients: [] }); }
}

// POST { patient } → store/update a full patient profile
export async function POST(req: Request) {
  let b: { patient?: Patient };
  try { b = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid body." }, { status: 400 }); }
  if (!b?.patient?.id) return Response.json({ ok: false, error: "patient.id required." }, { status: 400 });
  try { await savePatient(b.patient); return Response.json({ ok: true, persistent: isPersistent() }); }
  catch (e) { return Response.json({ ok: false, error: String(e) }, { status: 500 }); }
}
