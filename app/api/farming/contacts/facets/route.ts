import { requirePerm } from "@/lib/auth/authorize";
import { distinctFacet } from "@/lib/farming/contactsDb";

export const dynamic = "force-dynamic";

// GET /api/farming/contacts/facets?field=state|county|city&state=&county=
// Distinct values for a location filter dropdown, scoped by the parent
// selection (counties within a state, cities within a county).
export async function GET(req: Request) {
  const gate = await requirePerm(req, "farming.manage"); if (gate) return gate;
  const url = new URL(req.url);
  const field = url.searchParams.get("field");
  if (field !== "state" && field !== "county" && field !== "city") {
    return Response.json({ ok: false, error: "field must be state, county, or city." }, { status: 400 });
  }
  const parent = { state: url.searchParams.get("state") || undefined, county: url.searchParams.get("county") || undefined };
  const values = await distinctFacet(field, parent);
  return Response.json({ ok: true, values });
}
