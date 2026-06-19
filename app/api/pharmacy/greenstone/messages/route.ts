import { requireAuth } from "@/lib/auth/authorize";
import { greenstoneListMessages, greenstoneSendMessage } from "@/lib/pharmacy/greenstone";

export const dynamic = "force-dynamic";

// List the message thread for an order: GET ?orderId=...
export async function GET(req: Request) {
  const gate = requireAuth(req);
  if (gate) return gate;
  const orderId = new URL(req.url).searchParams.get("orderId");
  if (!orderId) return Response.json({ ok: false, error: "orderId is required." }, { status: 400 });
  const res = await greenstoneListMessages(orderId);
  return Response.json(res, { status: res.ok ? 200 : 502 });
}

// Send a message to the pharmacy on an order thread: POST { orderId, message }
export async function POST(req: Request) {
  const gate = requireAuth(req);
  if (gate) return gate;
  let b: { orderId?: string | number; message?: string };
  try { b = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 }); }
  if (b.orderId == null || !b.message?.trim()) {
    return Response.json({ ok: false, error: "orderId and a non-empty message are required." }, { status: 400 });
  }
  const res = await greenstoneSendMessage(b.orderId, b.message);
  return Response.json(res, { status: res.ok ? 200 : 502 });
}
