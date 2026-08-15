import { requirePerm } from "@/lib/auth/authorize";
import { allCampaignCounts } from "@/lib/farming/sendsDb";

export const dynamic = "force-dynamic";

// GET /api/farming/campaigns/analytics → per-campaign engagement counts
// (sent/delivered/opened/clicked/replied) aggregated from farming_sends, for the
// Overview funnel. One GROUP BY — cheap even with millions of send rows.
export async function GET(req: Request) {
  const gate = await requirePerm(req, "farming.manage"); if (gate) return gate;
  const counts = await allCampaignCounts();
  return Response.json({ ok: true, counts });
}
