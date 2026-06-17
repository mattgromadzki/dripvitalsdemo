import { greenstoneStatus } from "@/lib/pharmacy/greenstone";
import { requireAuth } from "@/lib/auth/authorize";

// GET /api/pharmacy/greenstone/order/[id]
// Numeric id is treated as the 5Axis order_id; otherwise as our internal_order_id.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = requireAuth(req);
  if (gate) return gate;

  const { id } = await params;
  const numeric = /^\d+$/.test(id);
  const result = await greenstoneStatus(numeric ? { order_id: Number(id) } : { internal_order_id: id });
  return Response.json(result, { status: result.ok ? 200 : 502 });
}
