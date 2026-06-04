import { registerStart, markComplete, listPending, isPersistent } from "@/lib/notify/pendingIntakes";

export const dynamic = "force-dynamic";

// POST { action: "start" | "complete", id, name?, email? }
export async function POST(req: Request) {
  let b: { action?: string; id?: string; name?: string; email?: string };
  try { b = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid body." }, { status: 400 }); }
  if (!b?.id || !b?.action) return Response.json({ ok: false, error: "id and action are required." }, { status: 400 });
  try {
    if (b.action === "start") await registerStart(b.id, b.name || "", b.email || "");
    else if (b.action === "complete") await markComplete(b.id);
    else return Response.json({ ok: false, error: "Unknown action." }, { status: 400 });
    return Response.json({ ok: true, persistent: isPersistent() });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// GET → list pending intakes (debug / admin visibility)
export async function GET() {
  try { return Response.json({ ok: true, persistent: isPersistent(), pending: await listPending() }); }
  catch (e) { return Response.json({ ok: false, error: String(e), pending: [] }); }
}
