import { emedRxStatus } from "@/lib/pharmacy/emed";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return Response.json(await emedRxStatus(id));
}
