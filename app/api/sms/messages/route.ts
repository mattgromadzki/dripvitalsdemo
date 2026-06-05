import { listInbound, getStatuses, isPersistent } from "@/lib/sms/inboundStore";
import { requireAuth } from "@/lib/auth/authorize";

export const dynamic = "force-dynamic";

// The SMS page polls this to pull in patient replies received by the webhook.
export async function GET(req: Request) {
  const gate = requireAuth(req); if (gate) return gate;
  try {
    const [messages, statuses] = await Promise.all([listInbound(200), getStatuses()]);
    return Response.json({ ok: true, persistent: isPersistent(), messages, statuses });
  } catch (e) {
    return Response.json({ ok: false, persistent: isPersistent(), messages: [], statuses: {}, error: String(e) });
  }
}
