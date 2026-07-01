import { requirePerm } from "@/lib/auth/authorize";
import { listActivatedEmails } from "@/lib/auth/patientAccounts";

export const dynamic = "force-dynamic";

// Which patients have activated their portal login (set their own password via
// the welcome / reset flow). Returns the lowercased emails so the EMR patient
// list can show a "portal active" vs "not set up" status. PHI-adjacent, so it
// requires the same permission as viewing the patient roster.
export async function GET(req: Request) {
  const gate = await requirePerm(req, "patients.view");
  if (gate) return gate;
  const emails = await listActivatedEmails();
  return Response.json({ ok: true, emails });
}
