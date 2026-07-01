import { cookies } from "next/headers";
import PortalApp from "@/components/portal/PortalApp";

// Legacy URL, kept so existing deep links (emailed reset/welcome links, payment
// returns, PWA start_url, bookmarks) never 404. Middleware normally redirects
// this to /login or /patient; this render is a safety net for anything that
// slips through, and it still handles the ?reset= / ?setpw= / ?cardUpdated=
// query params inside PortalApp.
export default async function PatientPortalLegacyPage() {
  const authed = Boolean((await cookies()).get("dv_patient"));
  return <PortalApp initialAuthed={authed} />;
}
