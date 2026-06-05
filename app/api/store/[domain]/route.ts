import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

// Domains allowed to persist (prevents arbitrary keys being written).
const ALLOW = new Set([
  "treatment-requests", "soap-notes", "prescriptions", "labs",
  "orders", "shipments", "tasks", "subscriptions", "visit-queue",
  "treatments", "intake-forms",
]);

const mem = new Map<string, unknown>();

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function GET(_req: Request, ctx: { params: Promise<{ domain: string }> }) {
  const { domain } = await ctx.params;
  if (!ALLOW.has(domain)) return Response.json({ ok: false, error: "Unknown domain." }, { status: 400 });
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
  let body: { data?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid body." }, { status: 400 }); }
  const r = redis();
  try {
    if (r) await r.set(`store:${domain}`, JSON.stringify(body.data ?? null));
    else mem.set(domain, body.data ?? null);
  } catch (e) { return Response.json({ ok: false, error: String(e) }, { status: 500 }); }
  return Response.json({ ok: true, persistent: !!r });
}
