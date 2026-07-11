import { Redis } from "@upstash/redis";
import { requirePerm } from "@/lib/auth/authorize";
import { hasDb } from "@/lib/db/client";
import { dbGetDomain, dbSetDomain } from "@/lib/db/store";
import { bumpVersion } from "@/lib/realtime/signal";
import { SEED_TREATMENTS } from "@/lib/data/treatmentsIntakeSeed";
import type { BaskTreatment } from "@/lib/types/treatmentsIntake";

export const dynamic = "force-dynamic";

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/**
 * Append the brand-name GLP-1 treatments (Ozempic/Wegovy/Mounjaro/Zepbound
 * monthly) to the LIVE treatments catalog — additively. No reset: existing
 * treatments, price edits, custom treatments, and pictures are untouched.
 * Matching is by name; already-present entries are skipped, id collisions get
 * fresh ids. Idempotent — safe to run repeatedly.
 *
 * Visit while signed in as an admin: GET /api/admin/add-brand-treatments
 */
export async function GET(req: Request) {
  const gate = await requirePerm(req, "settings.manage");
  if (gate) return gate;

  const wanted = SEED_TREATMENTS.filter((t) => /\(brand\)/i.test(t.name));
  if (!wanted.length) return Response.json({ ok: false, error: "No brand treatments in seed." }, { status: 500 });

  const useDb = hasDb();
  const r = useDb ? null : redis();
  let saved: BaskTreatment[] | null = null;
  try {
    if (useDb) { const d = await dbGetDomain("treatments"); saved = Array.isArray(d) ? (d as BaskTreatment[]) : null; }
    else if (r) { const v = await r.get("store:treatments"); const d = typeof v === "string" ? JSON.parse(v) : v; saved = Array.isArray(d) ? (d as BaskTreatment[]) : null; }
  } catch { /* fall through */ }

  // No saved catalog yet → the seed (which already includes them) applies on
  // fresh load; nothing to write.
  if (!saved || !saved.length) {
    return Response.json({ ok: true, message: "No saved catalog found — the defaults (which include the brand treatments) apply as-is.", added: [] });
  }

  const names = new Set(saved.map((t) => (t.name || "").toLowerCase()));
  let maxId = saved.reduce((m, t) => Math.max(m, t.id || 0), 0);
  const added: string[] = [];
  for (const t of wanted) {
    if (names.has(t.name.toLowerCase())) continue;
    const id = saved.some((x) => x.id === t.id) ? ++maxId : t.id;
    maxId = Math.max(maxId, id);
    saved.push({ ...t, id, includes: [...t.includes] });
    added.push(`${t.name} (id ${id})`);
  }

  if (added.length) {
    try {
      if (useDb) await dbSetDomain("treatments", saved);
      else if (r) await r.set("store:treatments", JSON.stringify(saved));
    } catch (e) { return Response.json({ ok: false, error: String(e) }, { status: 500 }); }
    await bumpVersion("treatments");
  }
  return Response.json({ ok: true, added: added.length ? added : ["(all four already present — no changes)"] });
}
