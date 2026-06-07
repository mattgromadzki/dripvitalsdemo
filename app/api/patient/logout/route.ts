import { PATIENT_COOKIE } from "@/lib/auth/patientSession";
export const dynamic = "force-dynamic";
export async function POST() {
  const res = Response.json({ ok: true });
  res.headers.append("Set-Cookie", `${PATIENT_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
  return res;
}
