import { lfSubmit } from "@/lib/pharmacy/lifefile";
import type { LFOrderBody } from "@/lib/pharmacy/lifefileTypes";

export async function POST(req: Request) {
  let body: LFOrderBody;
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON body.", source: "lifefile" }, { status: 400 }); }
  if (!body?.order?.patient || !Array.isArray(body?.order?.rxs) || body.order.rxs.length === 0) {
    return Response.json({ ok: false, error: "patient and at least one rx are required.", source: "lifefile" }, { status: 400 });
  }
  return Response.json(await lfSubmit(body));
}
