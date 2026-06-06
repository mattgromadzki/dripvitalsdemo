import { Redis } from "@upstash/redis";
import { requireAuth, requirePerm } from "@/lib/auth/authorize";

export const dynamic = "force-dynamic";

// Domains allowed to persist (prevents arbitrary keys being written).
const ALLOW = new Set([
  "treatment-requests", "soap-notes", "prescriptions", "labs",
  "orders", "shipments", "tasks", "subscriptions", "visit-queue",
  "treatments", "intake-forms",
  // communications
  "emails", "sms",
  // config catalogs / reference data
  "medications", "pharmacies", "doctors", "providers", "staff",
  "integrations", "rbac", "knowledge-base", "reviews", "leads",
  "consent", "inventory", "patient-documents", "titration",
  "referrals", "adverse", "campaigns", "affiliates", "billing",
]);

// Readable without a staff session — the PUBLIC patient intake form needs these
// to render the questionnaire. Everything else requires a signed-in staff session.
const PUBLIC_READ = new Set(["intake-forms", "treatments"]);

// Permission required to WRITE each domain. Unmapped domains default to owner-only.
const WRITE_PERM: Record<string, string> = {
  "treatment-requests": "intake.review",
  "soap-notes": "patients.edit",
  "prescriptions": "rx.prescribe",
  "labs": "labs.order",
  "orders": "patients.edit",
  "shipments": "patients.edit",
  "tasks": "patients.edit",
  "subscriptions": "subscriptions.manage",
  "visit-queue": "patients.edit",
  "treatments": "settings.manage",
  "intake-forms": "settings.manage",
  "emails": "email.send",
  "sms": "sms.send",
  "medications": "settings.manage",
  "pharmacies": "settings.manage",
  "doctors": "settings.manage",
  "providers": "settings.manage",
  "staff": "users.manage",
  "integrations": "integrations.manage",
  "rbac": "users.manage",
  "knowledge-base": "settings.manage",
  "reviews": "settings.manage",
  "leads": "patients.edit",
  "consent": "patients.edit",
  "inventory": "settings.manage",
  "patient-documents": "patients.edit",
  "titration": "titration.manage",
  "referrals": "patients.edit",
  "adverse": "adverse.manage",
  "campaigns": "campaigns.send",
  "affiliates": "campaigns.send",
  "billing": "payments.charge",
};

const mem = new Map<string, unknown>();

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function GET(req: Request, ctx: { params: Promise<{ domain: string }> }) {
  const { domain } = await ctx.params;
  if (!ALLOW.has(domain)) return Response.json({ ok: false, error: "Unknown domain." }, { status: 400 });
  if (!PUBLIC_READ.has(domain)) { const gate = requireAuth(req); if (gate) return gate; }
  const r = redis();
  let data: unknown = null;
  try {
    if (r) { const v = await r.get(`store:${domain}`); data = typeof v === "string" ? JSON.parse(v) : (v ?? null); }
    else data = mem.get(domain) ?? null;
  } catch { /* ignore */ }
  return Response.json({ ok: true, persistent: !!r, data });
}

export async function POST(req: Request, ctx: { params: Promise<{ domain: string }> }) {
  const { domain } = await ctx.params;
  if (!ALLOW.has(domain)) return Response.json({ ok: false, error: "Unknown domain." }, { status: 400 });
  const gate = await requirePerm(req, WRITE_PERM[domain] || "users.manage"); if (gate) return gate;
  let body: { data?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid body." }, { status: 400 }); }
  const r = redis();
  try {
    if (r) await r.set(`store:${domain}`, JSON.stringify(body.data ?? null));
    else mem.set(domain, body.data ?? null);
  } catch (e) { return Response.json({ ok: false, error: String(e) }, { status: 500 }); }
  return Response.json({ ok: true, persistent: !!r });
}
