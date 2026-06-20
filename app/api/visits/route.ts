import { rateLimit } from "@/lib/security/ratelimit";
import { requireAuth } from "@/lib/auth/authorize";
import { startVisit, updateVisit, markVisitPaid, removeVisit, listVisits } from "@/lib/visits/store";

export const dynamic = "force-dynamic";

// Lifecycle writes come from the PUBLIC intake form, so these are rate-limited
// rather than auth-gated. POST { action: "start" | "update" | "pay", id, ...fields }
export async function POST(req: Request) {
  const limited = await rateLimit(req, "intake"); if (limited) return limited;
  let b: { action?: string; id?: string } & Record<string, unknown>;
  try { b = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid body." }, { status: 400 }); }
  if (!b?.id || !b?.action) return Response.json({ ok: false, error: "id and action are required." }, { status: 400 });
  try {
    if (b.action === "start") {
      const { action, id, ...rest } = b;
      const v = await startVisit({ id: b.id, ...(rest as Partial<Parameters<typeof startVisit>[0]>) });
      return Response.json({ ok: true, visit: v });
    }
    if (b.action === "update") {
      const { action, id, ...patch } = b;
      const v = await updateVisit(b.id, patch as Record<string, unknown>);
      return Response.json({ ok: !!v, visit: v });
    }
    if (b.action === "pay") {
      const { action, id, ...patch } = b;
      const v = await markVisitPaid(b.id, patch as Record<string, unknown>);
      return Response.json({ ok: !!v, visit: v });
    }
    return Response.json({ ok: false, error: "Unknown action." }, { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// Admin: list all visits.
export async function GET(req: Request) {
  const gate = requireAuth(req); if (gate) return gate;
  try { return Response.json({ ok: true, visits: await listVisits() }); }
  catch (e) { return Response.json({ ok: false, error: String(e), visits: [] }); }
}

// Admin: delete a visit. DELETE ?id=V-...
export async function DELETE(req: Request) {
  const gate = requireAuth(req); if (gate) return gate;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ ok: false, error: "id is required." }, { status: 400 });
  const removed = await removeVisit(id);
  return Response.json({ ok: removed });
}
