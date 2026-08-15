import { requirePerm } from "@/lib/auth/authorize";
import { aggregateCounts, groupCounts, countContacts, type ContactFilter } from "@/lib/farming/contactsDb";

export const dynamic = "force-dynamic";

// GET /api/farming/contacts/count → aggregate KPIs + per-group counts, and
// (when filters are present) the count matching the current filter (for the
// list footer and "select all N matching").
export async function GET(req: Request) {
  const gate = await requirePerm(req, "farming.manage"); if (gate) return gate;
  const url = new URL(req.url);
  const [agg, groups] = await Promise.all([aggregateCounts(), groupCounts()]);
  let filtered: number | undefined;
  const filter: ContactFilter = {
    search: url.searchParams.get("search") || undefined,
    status: url.searchParams.get("status") || undefined,
    group: url.searchParams.get("group") || undefined,
    includeSuppressed: url.searchParams.get("includeSuppressed") === "true",
  };
  // Always compute the filtered count — the default view excludes suppressed
  // contacts, so even "no filters" differs from the raw total.
  filtered = await countContacts(filter);
  return Response.json({ ok: true, ...agg, groups, filtered });
}
