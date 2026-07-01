import { cookies } from "next/headers";
import PortalApp from "@/components/portal/PortalApp";

// The authenticated patient app. Middleware redirects signed-out visitors to
// /login before this renders; we still read the session cookie so the client
// can show a neutral splash (not the sign-in form) until auth hydrates.
export default async function PatientPage() {
  const authed = Boolean((await cookies()).get("dv_patient"));
  return <PortalApp initialAuthed={authed} />;
}
