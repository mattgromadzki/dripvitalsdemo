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

/**
 * One-time migration: merge each seed doctor's licenses (lib/data/doctors.ts —
 * the authoritative list the owner supplied) into the SAVED doctors record in
 * the database, then bump the change signal so every open tab refetches.
 *
 * Why this exists: the saved doctors blob predates the license update, and
 * because saved data always hydrates over code defaults (by design), editing the
 * seed alone can't fix the stored copy. This writes the store directly on the
 * server — no client races, no silent failures — and reports what changed.
 *
 * Visit while signed in as an admin: GET /api/admin/sync-doctor-licenses
 * Idempotent: running it again is a no-op once the store matches the seed.
 */
export async function GET(req: Request) {
  const gate = await requirePerm(req, "settings.manage");
  if (gate) return gate;

  const useDb = hasDb();
  const r = useDb ? null : redis();

  // Read the saved doctors blob through the same backend chain the app uses.
  let saved: Doctor[] | null = null;
  try {
    if (useDb) { const d = await dbGetDomain("doctors"); saved = Array.isArray(d) ? (d as Doctor[]) : null; }
    else if (r) { const v = await r.get("store:doctors"); const d = typeof v === "string" ? JSON.parse(v) : v; saved = Array.isArray(d) ? (d as Doctor[]) : null; }
  } catch { /* fall through */ }

  const report: { doctor: string; before: number; after: number }[] = [];
  let next: Doctor[];

  if (!saved || !saved.length) {
    // Nothing stored yet → store the seed as-is.
    next = SEED;
    for (const d of SEED) report.push({ doctor: `${d.first} ${d.last}`, before: 0, after: d.licenses.length });
  } else {
    next = saved.map((doc) => {
      const seedDoc =
        SEED.find((s) => s.id === doc.id) ||
        SEED.find((s) => s.first.toLowerCase() === (doc.first || "").toLowerCase() && s.last.toLowerCase() === (doc.last || "").toLowerCase());
      if (!seedDoc || !seedDoc.licenses.length) return doc;
      const before = (doc.licenses || []).length;
      // Seed is authoritative: take every seed license (number + expDate), and
      // keep any extra states that were added manually in the UI.
      const seedStates = new Set(seedDoc.licenses.map((l) => l.state));
      const extras = (doc.licenses || []).filter((l) => !seedStates.has(l.state));
      const merged = [...seedDoc.licenses.map((l) => ({ ...l })), ...extras];
      report.push({ doctor: `${doc.first} ${doc.last}`, before, after: merged.length });
      return { ...doc, licenses: merged };
    });
    // Seed doctors missing from the store entirely get appended.
    for (const s of SEED) {
      const exists = next.some((d) => d.id === s.id || (d.first?.toLowerCase() === s.first.toLowerCase() && d.last?.toLowerCase() === s.last.toLowerCase()));
      if (!exists) { next.push(s); report.push({ doctor: `${s.first} ${s.last}`, before: 0, after: s.licenses.length }); }
    }
  }

  try {
    if (useDb) await dbSetDomain("doctors", next);
    else if (r) await r.set("store:doctors", JSON.stringify(next));
    else return Response.json({ ok: false, error: "No persistent backend configured (Postgres/Redis missing) — nothing to migrate." }, { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
  await bumpVersion("doctors");

  return Response.json({
    ok: true,
    backend: useDb ? "postgres" : "redis",
    message: "Doctor licenses synced from file into the saved record. Refresh the Doctors page to see them.",
    doctors: report,
  });
}
