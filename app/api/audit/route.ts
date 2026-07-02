import { requireAuth, requirePerm, getSession } from "@/lib/auth/authorize";
import { appendAuditEvent, listAuditEvents } from "@/lib/audit/store";

export const dynamic = "force-dynamic";

function clientIp(req: Request): string | undefined {
  const xff = req.headers.get("x-forwarded-for");
  return xff ? xff.split(",")[0].trim() : (req.headers.get("x-real-ip") || undefined) || undefined;
}

// Record an access event. Any authenticated staff member can log their own
// action; the actor is taken from the verified session, not the request body,
// so it can't be spoofed. Body: { action, patientId?, detail? }.
export async function POST(req: Request) {
  const gate = requireAuth(req);
  if (gate) return gate;
  const claims = getSession(req);
  if (!claims) return Response.json({ ok: false, error: "Sign in required." }, { status: 401 });

  let b: { action?: string; patientId?: string; detail?: string };
  try { b = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid body." }, { status: 400 }); }
  if (!b?.action) return Response.json({ ok: false, error: "action is required." }, { status: 400 });

  await appendAuditEvent({
    action: String(b.action).slice(0, 64),
    actorEmail: claims.email,
    actorName: claims.name,
    actorRole: claims.role,
    patientId: b.patientId ? String(b.patientId).slice(0, 64) : undefined,
    detail: b.detail ? String(b.detail).slice(0, 300) : undefined,
    ip: clientIp(req),
  });
  return Response.json({ ok: true });
}

// Read the audit trail. PHI-adjacent and administrative, so it requires the
// user-management permission (owner/admin).
export async function GET(req: Request) {
  const gate = await requirePerm(req, "users.manage");
  if (gate) return gate;
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") || "500");
  const events = await listAuditEvents(Number.isFinite(limit) ? limit : 500);
  return Response.json({ ok: true, events });
}
