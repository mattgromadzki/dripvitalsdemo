import { listInbound, isPersistent } from "@/lib/sms/inboundStore";

export const dynamic = "force-dynamic";

// The SMS page polls this to pull in patient replies received by the webhook.
export async function GET() {
  try {
    const messages = await listInbound(200);
    return Response.json({ ok: true, persistent: isPersistent(), messages });
  } catch (e) {
    return Response.json({ ok: false, persistent: isPersistent(), messages: [], error: String(e) });
  }
}
