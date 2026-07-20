import { requirePerm, getSession } from "@/lib/auth/authorize";
import { bumpPatientSessionVersion } from "@/lib/auth/patientSession";
import { appendAuditEvent } from "@/lib/audit/store";

export const dynamic = "force-dynamic";

// INCIDENT KILL-SWITCH: instantly invalidate every existing portal session for a
// patient (leaked link, shared device, compromised account). Their password is
// unchanged — they simply sign in again; anyone holding an old session is
// locked out immediately.
//
// Visit while signed in as an admin:
//   GET /api/admin/revoke-patient-sessions?pid=PT-1005
export async function GET(req: Request) {
  const gate = await requirePerm(req, "users.manage");
  if (gate) return gate;
  const pid = (new URL(req.url).searchParams.get("pid") || "").trim();
  if (!/^PT-\d+$/.test(pid)) return Response.json({ ok: false, error: "Pass ?pid=PT-XXXX" }, { status: 400 });
  const v = await bumpPatientSessionVersion(pid);
  if (!v) return Response.json({ ok: false, error: "No Redis configured — session revocation requires Upstash." }, { status: 500 });
  try {
    const c = getSession(req);
    await appendAuditEvent({
      action: "security.sessions_revoked",
      actorEmail: c?.email || "admin",
      actorName: c?.name,
      actorRole: c?.role,
      patientId: pid,
      detail: `All portal sessions invalidated (version ${v})`,
    });
  } catch { /* best-effort */ }
  return Response.json({ ok: true, pid, message: `All existing portal sessions for ${pid} are now invalid. The patient signs in again normally.` });
}
