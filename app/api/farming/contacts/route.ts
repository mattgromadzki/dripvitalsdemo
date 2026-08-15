import { requirePerm } from "@/lib/auth/authorize";
import { listContacts, buildContact, upsertContact, type ContactFilter } from "@/lib/farming/contactsDb";
import type { ContactInput } from "@/lib/types/farming";

export const dynamic = "force-dynamic";

function filterFrom(url: URL): ContactFilter {
  return {
    search: url.searchParams.get("search") || undefined,
    status: url.searchParams.get("status") || undefined,
    group: url.searchParams.get("group") || undefined,
    includeSuppressed: url.searchParams.get("includeSuppressed") === "true",
  };
}

// GET /api/farming/contacts?search=&status=&group=&includeSuppressed=&cursor=&limit=
export async function GET(req: Request) {
  const gate = await requirePerm(req, "farming.manage"); if (gate) return gate;
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));
  const page = await listContacts(filterFrom(url), cursor, limit);
  return Response.json({ ok: true, ...page });
}

// POST /api/farming/contacts  { contact: ContactInput }  → create one
export async function POST(req: Request) {
  const gate = await requirePerm(req, "farming.manage"); if (gate) return gate;
  let body: { contact?: ContactInput };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid body." }, { status: 400 }); }
  if (!body.contact) return Response.json({ ok: false, error: "contact is required." }, { status: 400 });
  const c = buildContact(body.contact);
  await upsertContact(c);
  return Response.json({ ok: true, contact: c });
}
