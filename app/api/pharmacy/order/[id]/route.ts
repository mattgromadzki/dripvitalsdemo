import { emedOrderStatus, emedCancel } from "@/lib/pharmacy/emed";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return Response.json(await emedOrderStatus(id));
}
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return Response.json(await emedCancel(id));
}
