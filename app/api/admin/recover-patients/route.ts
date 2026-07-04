import { Redis } from "@upstash/redis";
import { requirePerm } from "@/lib/auth/authorize";
import { listPatients, savePatient } from "@/lib/crm/patients";
import { hasDb } from "@/lib/db/client";
import { dbGetDomain } from "@/lib/db/store";
import type { Patient } from "@/lib/types";

export const dynamic = "force-dynamic";

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/**
 * Diagnose (and optionally repair) a missing patient roster.
 *
 * The EMR reads patients from the CRM store. Older builds persisted them in a
 * whole-roster blob ("store:patients" in Redis, or the "patients" domain in
 * Postgres). If the roster looks empty after switching off demo data, any real
 * patients stranded in the legacy blob are invisible to the EMR.
 *
 * GET  /api/admin/recover-patients          → report counts + names (no changes)
 * GET  /api/admin/recover-patients?apply=1  → import legacy records missing from
 *                                             the CRM store, then report
 *
 * Admin-gated; idempotent (already-present ids are skipped, never overwritten).
 */
export async function GET(req: Request) {
  const gate = await requirePerm(req, "settings.manage");
  if (gate) return gate;
  const apply = new URL(req.url).searchParams.get("apply") === "1";

  // Current roster (what the EMR sees).
  let crm: Patient[] = [];
  try { crm = await listPatients(); } catch { /* report as empty */ }
  const crmIds = new Set(crm.map((p) => p.id));

  // Legacy locations.
  const legacy: Patient[] = [];
  const seen = new Set<string>();
  const collect = (data: unknown) => {
    if (!Array.isArray(data)) return;
    for (const p of data as Patient[]) {
      if (p && typeof p.id === "string" && p.id && !seen.has(p.id)) { seen.add(p.id); legacy.push(p); }
    }
  };
  try { if (hasDb()) collect(await dbGetDomain("patients")); } catch { /* ignore */ }
  try {
    const r = redis();
    if (r) { const v = await r.get("store:patients"); collect(typeof v === "string" ? JSON.parse(v) : v); }
  } catch { /* ignore */ }

  const strandedAll = legacy.filter((p) => !crmIds.has(p.id));
  // Demo seed records may also be sitting in a legacy blob from demo-mode
  // sessions; only auto-import ones that look real (have an email), and list the
  // rest so nothing is hidden.
  const stranded = strandedAll.filter((p) => !!p.email);

  let imported = 0;
  if (apply) {
    for (const p of stranded) {
      try { await savePatient(p); imported++; } catch { /* keep going */ }
    }
  }

  const summarize = (list: Patient[]) => list.map((p) => `${p.id} · ${p.name || "(no name)"} · ${p.email || "(no email)"}`);
  return Response.json({
    ok: true,
    mode: apply ? "APPLIED" : "report-only (add ?apply=1 to import)",
    currentRoster: { count: crm.length, patients: summarize(crm) },
    legacyStorage: { count: legacy.length, strandedNotInRoster: summarize(strandedAll) },
    ...(apply ? { imported } : { wouldImport: summarize(stranded) }),
  });
}
