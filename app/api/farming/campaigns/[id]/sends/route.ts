import { requirePerm } from "@/lib/auth/authorize";
import { campaignCounts, listSends } from "@/lib/farming/sendsDb";
import { getContact } from "@/lib/farming/contactsDb";

export const dynamic = "force-dynamic";

// GET /api/farming/campaigns/:id/sends?offset=&limit=
// Per-recipient outcomes for CampaignDetails: engagement counts + a page of
// send rows with recipient names resolved.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requirePerm(req, "farming.manage"); if (gate) return gate;
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "100", 10)));

  const [counts, sends] = await Promise.all([campaignCounts(id), listSends(id, offset, limit)]);
  const rows = await Promise.all(sends.map(async (s) => {
    const c = await getContact(s.contactId);
    return { ...s, name: c ? [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || c.id : s.contactId };
  }));
  return Response.json({ ok: true, counts, sends: rows });
}
