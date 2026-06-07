import { getPatientSession } from "@/lib/auth/patientSession";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const s = getPatientSession(req);
  if (!s) return new Response(JSON.stringify({ ok: false }), { status: 401, headers: { "Content-Type": "application/json" } });
  return Response.json({ ok: true, patient: { id: s.pid, name: s.name, email: s.email } });
}
