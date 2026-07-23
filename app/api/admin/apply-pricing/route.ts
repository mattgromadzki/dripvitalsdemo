import { Redis } from "@upstash/redis";
import { requirePerm } from "@/lib/auth/authorize";
import { hasDb } from "@/lib/db/client";
import { dbGetDomain, dbSetDomain } from "@/lib/db/store";
import { bumpVersion } from "@/lib/realtime/signal";
import { SEED_TREATMENTS } from "@/lib/data/treatmentsIntakeSeed";
import type { BaskTreatment, BaskBillingCycle } from "@/lib/types/treatmentsIntake";

export const dynamic = "force-dynamic";

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/** The July 2026 pricing matrix. Matched against the LIVE catalog by exact
 *  medication + term. Missing terms are created by cloning the same
 *  medication's shortest existing plan; Scream Cream is added from the seed. */
const RULES: { med: string; months: number; price: string; billing: BaskBillingCycle; compare?: string; name?: string }[] = [
  { med: "Tirzepatide", months: 1,  price: "$279",   billing: "monthly" },
  { med: "Tirzepatide", months: 3,  price: "$597",   billing: "quarterly" },
  { med: "Tirzepatide", months: 6,  price: "$954",   billing: "semi-annual" },
  { med: "Tirzepatide", months: 12, price: "$1,548", billing: "annual", compare: "$3,348", name: "12-Month Tirzepatide Program" },
  { med: "Semaglutide", months: 1,  price: "$179",   billing: "monthly" },
  { med: "Semaglutide", months: 3,  price: "$417",   billing: "quarterly" },
  { med: "Semaglutide", months: 6,  price: "$714",   billing: "semi-annual", compare: "$1,074", name: "6-Month Semaglutide Treatment" },
  { med: "Semaglutide", months: 12, price: "$1,188", billing: "annual" },
  { med: "Sermorelin",  months: 1,  price: "$179",   billing: "monthly" },
  { med: "Sermorelin",  months: 3,  price: "$417",   billing: "quarterly" },
  { med: "Sermorelin",  months: 6,  price: "$594",   billing: "semi-annual", compare: "$1,074", name: "6-Month Sermorelin Therapy" },
  { med: "NAD+",        months: 1,  price: "$189",   billing: "monthly" },
  { med: "NAD+",        months: 3,  price: "$447",   billing: "quarterly" },
  { med: "NAD+",        months: 6,  price: "$714",   billing: "semi-annual", compare: "$1,134", name: "6-Month NAD+ Injections" },
  { med: "NAD+",        months: 12, price: "$1,068", billing: "annual", compare: "$2,268", name: "12-Month NAD+ Injections" },
  { med: "Glutathione", months: 1,  price: "$139",   billing: "monthly" },
  { med: "Glutathione", months: 3,  price: "$357",   billing: "quarterly" },
  { med: "Glutathione", months: 6,  price: "$594",   billing: "semi-annual", compare: "$834", name: "6-Month Glutathione Injections" },
  { med: "Glutathione", months: 12, price: "$1,068", billing: "annual", compare: "$1,668", name: "12-Month Glutathione Injections" },
  { med: "Scream Cream (topical)", months: 3, price: "$89.97", billing: "quarterly", name: "3-Month Scream Cream" },
  { med: "Semaglutide (oral)", months: 1,  price: "$179",   billing: "monthly" },
  { med: "Semaglutide (oral)", months: 3,  price: "$477",   billing: "quarterly" },
  { med: "Semaglutide (oral)", months: 6,  price: "$894",   billing: "semi-annual", compare: "$1,074", name: "6-Month Oral Semaglutide" },
  { med: "Semaglutide (oral)", months: 12, price: "$1,548", billing: "annual",      compare: "$2,148", name: "12-Month Oral Semaglutide" },
  { med: "Tirzepatide (oral)", months: 1,  price: "$249",   billing: "monthly" },
  { med: "Tirzepatide (oral)", months: 3,  price: "$717",   billing: "quarterly" },
  { med: "Tirzepatide (oral)", months: 6,  price: "$1,374", billing: "semi-annual", compare: "$1,494", name: "6-Month Oral Tirzepatide" },
  { med: "Tirzepatide (oral)", months: 12, price: "$2,388", billing: "annual",      compare: "$2,988", name: "12-Month Oral Tirzepatide" },
  { med: "Stella Anti-Aging Cream (topical)", months: 1, price: "$99", billing: "monthly", name: "1-Month Stella Anti-Aging Cream" },
];

/**
 * Apply the pricing matrix to the LIVE treatments catalog — in place. Updates
 * price/billing on matching plans, creates missing terms, touches nothing else
 * (custom treatments, pictures, other products untouched). Idempotent.
 *
 * GET /api/admin/apply-pricing (admin-gated)
 */
export async function GET(req: Request) {
  const gate = await requirePerm(req, "settings.manage");
  if (gate) return gate;

  const useDb = hasDb();
  const r = useDb ? null : redis();
  let saved: BaskTreatment[] | null = null;
  try {
    if (useDb) { const d = await dbGetDomain("treatments"); saved = Array.isArray(d) ? (d as BaskTreatment[]) : null; }
    else if (r) { const v = await r.get("store:treatments"); const d = typeof v === "string" ? JSON.parse(v) : v; saved = Array.isArray(d) ? (d as BaskTreatment[]) : null; }
  } catch { /* fall through */ }

  if (!saved || !saved.length) {
    return Response.json({ ok: true, message: "No saved catalog — the defaults (already at the new pricing) apply as-is.", changes: [] });
  }

  const changes: string[] = [];
  let maxId = saved.reduce((m, t) => Math.max(m, t.id || 0), 0);

  for (const rule of RULES) {
    const hit = saved.find((t) => t.med === rule.med && parseInt(t.duration, 10) === rule.months);
    if (hit) {
      const before = `${hit.price} (${hit.billing})`;
      if (hit.price !== rule.price || hit.billing !== rule.billing) {
        hit.price = rule.price; hit.billing = rule.billing;
        if (rule.compare) hit.compare = rule.compare;
        changes.push(`${hit.name}: ${before} → ${rule.price} (${rule.billing})`);
      }
      continue;
    }
    // Create the missing term: clone the same med's shortest live plan, else seed.
    const base =
      saved.filter((t) => t.med === rule.med).sort((a, b) => parseInt(a.duration, 10) - parseInt(b.duration, 10))[0] ||
      SEED_TREATMENTS.find((t) => t.med === rule.med);
    if (!base) { changes.push(`SKIPPED ${rule.med} ${rule.months}mo — no base plan found to clone`); continue; }
    const created: BaskTreatment = {
      ...base,
      id: ++maxId,
      name: rule.name || `${rule.months}-Month ${base.name.replace(/^\d+-Month\s*/, "")}`,
      duration: String(rule.months),
      billing: rule.billing,
      price: rule.price,
      compare: rule.compare || "",
      featured: false,
      subscribers: 0,
      includes: [...(base.includes || [])],
    };
    saved.push(created);
    changes.push(`ADDED ${created.name} — ${rule.price} (${rule.billing}), id ${created.id}`);
  }

  if (changes.length) {
    try {
      if (useDb) await dbSetDomain("treatments", saved);
      else if (r) await r.set("store:treatments", JSON.stringify(saved));
    } catch (e) { return Response.json({ ok: false, error: String(e) }, { status: 500 }); }
    await bumpVersion("treatments");
  }
  return Response.json({ ok: true, changes: changes.length ? changes : ["Catalog already matches the pricing matrix — no changes."] });
}
