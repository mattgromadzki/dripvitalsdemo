import { requireAuth } from "@/lib/auth/authorize";
import { getVersions, signalsEnabled } from "@/lib/realtime/signal";

export const dynamic = "force-dynamic";

// GET /api/sync/versions?domains=orders,sms,tasks
// Returns each domain's change-counter from Redis. This is the heartbeat the
// client polls instead of the database — it reads only Redis, so it never wakes
// Postgres. `enabled:false` tells the client to fall back to periodic polling.
export async function GET(req: Request) {
  const gate = requireAuth(req);
  if (gate) return gate;

  const enabled = signalsEnabled();
  const url = new URL(req.url);
  const domains = (url.searchParams.get("domains") || "")
    .split(",").map((s) => s.trim()).filter(Boolean);

  const versions = enabled ? await getVersions(domains) : {};
  return Response.json({ ok: true, enabled, versions });
}
