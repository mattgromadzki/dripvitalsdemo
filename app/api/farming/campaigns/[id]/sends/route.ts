import { requirePerm } from "@/lib/auth/authorize";
import { campaignCounts, listSends, countSends, type SendFilter } from "@/lib/farming/sendsDb";
import { getContact } from "@/lib/farming/contactsDb";

export const dynamic = "force-dynamic";

const FILTERS = new Set(["all", "delivered", "opened", "clicked", "replied", "bounced", "unsubscribed", "not_opened"]);

// GET /api/farming/campaigns/:id/sends?offset=&limit=&filter=
// Per-recipient outcomes for the campaign report: engagement counts + a filtered,
// paginated page of send rows with recipient name + email resolved.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requirePerm(req, "farming.manage"); if (gate) return gate;
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "100", 10)));
  const fp = url.searchParams.get("filter") || "all";
  const filter: SendFilter = (FILTERS.has(fp) ? fp : "all") as SendFilter;

  const [counts, sends, total] = await Promise.all([campaignCounts(id), listSends(id, offset, limit, filter), countSends(id, filter)]);
  const rows = await Promise.all(sends.map(async (s) => {
    const c = await getContact(s.contactId);
    return { ...s, name: c ? [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || c.id : s.contactId, email: c?.email || "" };
  }));
  return Response.json({ ok: true, counts, sends: rows, total });
}
