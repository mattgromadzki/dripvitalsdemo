import PortalApp from "@/components/portal/PortalApp";

// Patient sign-in screen. (The staff EMR owns /login; the patient sign-in is
// namespaced here under /patient/login.) If a valid session already exists, the
// client syncs the URL to /patient and middleware redirects direct hits.
export default function PatientLoginPage() {
  return <PortalApp initialAuthed={false} />;
}
