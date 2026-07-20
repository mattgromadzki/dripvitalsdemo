import { getVerifiedPatientSession } from "@/lib/auth/patientSession";
import { getPatientById } from "@/lib/crm/patients";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const s = await getVerifiedPatientSession(req);
  if (!s) return new Response(JSON.stringify({ ok: false }), { status: 401, headers: { "Content-Type": "application/json" } });
  let full = null;
  try { full = await getPatientById(s.pid); } catch { /* ignore */ }
  const patient = full || { id: s.pid, name: s.name, email: s.email };
  return Response.json({ ok: true, patient });
}
