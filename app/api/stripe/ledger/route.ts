import { list, isPersistent } from "@/lib/payments/stripeLedger";
import { publicConfig } from "@/lib/payments/provider";
import { requireAuth } from "@/lib/auth/authorize";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = requireAuth(req);
  if (gate) return gate;
  const cfg = publicConfig();
  const entries = await list();
  return Response.json({ ok: true, provider: cfg.provider, enabled: cfg.ready, persistent: isPersistent(), entries });
}
