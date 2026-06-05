import { savePatient, listPatients, isPersistent } from "@/lib/crm/patients";
import { requirePerm } from "@/lib/auth/authorize";
import type { Patient } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET → all intake-created patients (for the EMR to hydrate). Reading the full
// patient list is sensitive PHI, so it requires the patients.view permission.
export async function GET(req: Request) {
  const gate = await requirePerm(req, "patients.view"); if (gate) return gate;
  try { return Response.json({ ok: true, persistent: isPersistent(), patients: await listPatients() }); }
  catch (e) { return Response.json({ ok: false, error: String(e), patients: [] }); }
}

// POST { patient } → store/update a full patient profile.
// NOTE: left open because the PUBLIC intake form self-registers a patient here
// (the visitor has no staff session). Staff edits also flow through this path.
// In production, intake self-registration and staff edits should be separated so
// this can require patients.edit without breaking signup.
export async function POST(req: Request) {
  let b: { patient?: Patient };
  try { b = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid body." }, { status: 400 }); }
  if (!b?.patient?.id) return Response.json({ ok: false, error: "patient.id required." }, { status: 400 });
  try { await savePatient(b.patient); return Response.json({ ok: true, persistent: isPersistent() }); }
  catch (e) { return Response.json({ ok: false, error: String(e) }, { status: 500 }); }
}
