import { listTemplates, saveTemplate, defaultTemplates, defaultTemplate } from "@/lib/notify/templates";
import { requireAuth, requirePerm } from "@/lib/auth/authorize";

export const dynamic = "force-dynamic";

function persistent() {
  return !!((process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) && (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN));
}

// GET → saved templates. GET ?defaults=1 → factory defaults (for "reset").
export async function GET(req: Request) {
  const gate = requireAuth(req); if (gate) return gate;
  const wantDefaults = new URL(req.url).searchParams.get("defaults") === "1";
  try {
    const templates = wantDefaults ? defaultTemplates() : await listTemplates();
    return Response.json({ ok: true, persistent: persistent(), templates });
  } catch (e) {
    return Response.json({ ok: false, persistent: persistent(), templates: defaultTemplates(), error: String(e) });
  }
}

// POST { type, subject, html } → save a custom template.
export async function POST(req: Request) {
  const gate = await requirePerm(req, "settings.manage"); if (gate) return gate;
  let b: { type?: string; subject?: string; html?: string };
  try { b = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid body." }, { status: 400 }); }
  if (!b?.type || !defaultTemplate(b.type)) return Response.json({ ok: false, error: "Unknown template type." }, { status: 400 });
  if (!b.html) return Response.json({ ok: false, error: "HTML is required." }, { status: 400 });
  try {
    await saveTemplate(b.type, b.subject || defaultTemplate(b.type)!.subject, b.html);
    return Response.json({ ok: true, persistent: persistent() });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
