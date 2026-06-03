import { lfSetStatus } from "@/lib/pharmacy/lifefile";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let statusId = "";
  try { const b = await req.json(); statusId = b?.statusId || b?.status || ""; } catch { /* empty */ }
  if (!statusId) return Response.json({ ok: false, error: "statusId is required.", source: "lifefile" }, { status: 400 });
  return Response.json(await lfSetStatus(id, statusId));
}
