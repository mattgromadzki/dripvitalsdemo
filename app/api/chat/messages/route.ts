import { appendChat, listChat, isPersistent, type ChatMsgRecord } from "@/lib/chat/store";

export const dynamic = "force-dynamic";

// Read a thread (?pid=) or all chat messages.
export async function GET(req: Request) {
  const pid = new URL(req.url).searchParams.get("pid") || undefined;
  try {
    const messages = await listChat(pid);
    return Response.json({ ok: true, persistent: isPersistent(), messages });
  } catch (e) {
    return Response.json({ ok: false, persistent: isPersistent(), messages: [], error: String(e) });
  }
}

// Append a message from either the patient (portal) or the care team (EMR).
export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid body." }, { status: 400 }); }
  if (!b?.pid || !b?.from || (!b?.text && !b?.attachment)) {
    return Response.json({ ok: false, error: "pid, from, and text/attachment are required." }, { status: 400 });
  }
  const msg: ChatMsgRecord = {
    id: String(b.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    pid: String(b.pid),
    from: String(b.from),
    text: String(b.text || ""),
    time: String(b.time || "Just now"),
    attachment: b.attachment,
    ts: Date.now(),
  };
  try { await appendChat(msg); } catch (e) { return Response.json({ ok: false, error: String(e) }, { status: 500 }); }
  return Response.json({ ok: true, message: msg });
}
