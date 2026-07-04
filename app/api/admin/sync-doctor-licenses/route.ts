import { Redis } from "@upstash/redis";
import { requirePerm } from "@/lib/auth/authorize";
import { hasDb } from "@/lib/db/client";
import { dbGetDomain, dbSetDomain } from "@/lib/db/store";
import { bumpVersion } from "@/lib/realtime/signal";
import { DOCTORS as SEED } from "@/lib/data/doctors";
import type { Doctor } from "@/lib/types";

export const dynamic = "force-dynamic";

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const norm = (s?: string) => (s || "").trim().toLowerCase();

/** Same person? Match by id, or by last name with tolerant first-name check —
 *  live profiles sometimes fold the middle name into first ("Emmanuel Noel"),
 *  so containment in either direction counts, and a unique last name suffices. */
function samePerson(a: Doctor, b: Doctor, seedList: Doctor[]): boolean {
  if (a.id === b.id) return true;
  if (norm(a.last) !== norm(b.last)) return false;
  const fa = norm(a.first), fb = norm(b.first);
  if (!fa || !fb || fa.includes(fb) || fb.includes(fa)) return true;
  // Last name unique across the seed roster → safe to treat as the same doctor.
  return seedList.filter((d) => norm(d.last) === norm(b.last)).length === 1;
}

/**
 * Merge each seed doctor's licenses into the SAVED doctors record, matching the
 * person tolerantly, and REMOVE any duplicate profile a previous (stricter) run
 * appended. Idempotent — safe to run repeatedly.
 * GET /api/admin/sync-doctor-licenses  (admin-gated)
 */
export async function GET(req: Request) {
  const gate = await requirePerm(req, "settings.manage");
  if (gate) return gate;

  const useDb = hasDb();
  const r = useDb ? null : redis();

  let saved: Doctor[] | null = null;
  try {
    if (useDb) { const d = await dbGetDomain("doctors"); saved = Array.isArray(d) ? (d as Doctor[]) : null; }
    else if (r) { const v = await r.get("store:doctors"); const d = typeof v === "string" ? JSON.parse(v) : v; saved = Array.isArray(d) ? (d as Doctor[]) : null; }
  } catch { /* fall through */ }

  const report: string[] = [];
  let next: Doctor[];

  if (!saved || !saved.length) {
    next = SEED;
    for (const d of SEED) report.push(`${d.first} ${d.last}: stored from file with ${d.licenses.length} licenses`);
  } else {
    // 1) Drop seed-clone duplicates: a record whose id matches a seed doc while a
    //    DIFFERENT saved record is the same person (the real profile). Union its
    //    licenses into the real profile before dropping it.
    const clones = new Set<Doctor>();
    for (const doc of saved) {
      const seedTwin = SEED.find((s) => s.id === doc.id);
      if (!seedTwin) continue;
      const original = saved.find((o) => o !== doc && samePerson(o, doc, SEED));
      if (original) {
        const have = new Set((original.licenses || []).map((l) => l.state));
        original.licenses = [...(original.licenses || []), ...(doc.licenses || []).filter((l) => !have.has(l.state))];
        clones.add(doc);
        report.push(`Removed duplicate profile "${doc.first} ${doc.last}" (${doc.id}); merged its licenses into "${original.first} ${original.last}" (${original.id})`);
      }
    }
    next = saved.filter((d) => !clones.has(d));

    // 2) Merge seed licenses into the matched real profiles (seed authoritative
    //    per state; manual extra states kept).
    for (const doc of next) {
      const seedDoc = SEED.find((s) => samePerson(doc, s, SEED));
      if (!seedDoc || !seedDoc.licenses.length) continue;
      const before = (doc.licenses || []).length;
      const seedStates = new Set(seedDoc.licenses.map((l) => l.state));
      const extras = (doc.licenses || []).filter((l) => !seedStates.has(l.state));
      doc.licenses = [...seedDoc.licenses.map((l) => ({ ...l })), ...extras];
      if (doc.licenses.length !== before) report.push(`${doc.first} ${doc.last} (${doc.id}): licenses ${before} → ${doc.licenses.length}`);
    }

    // 3) Append seed doctors that genuinely don't exist yet.
    for (const s of SEED) {
      if (!next.some((d) => samePerson(d, s, SEED))) { next.push(s); report.push(`${s.first} ${s.last}: added with ${s.licenses.length} licenses`); }
    }
  }

  try {
    if (useDb) await dbSetDomain("doctors", next);
    else if (r) await r.set("store:doctors", JSON.stringify(next));
    else return Response.json({ ok: false, error: "No persistent backend configured — nothing to migrate." }, { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
  await bumpVersion("doctors");

  return Response.json({ ok: true, backend: useDb ? "postgres" : "redis", changes: report.length ? report : ["Already in sync — no changes needed."] });
}
