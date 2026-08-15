import { requirePerm } from "@/lib/auth/authorize";
import { bulkSetStatus, bulkAddGroup, bulkMoveGroup, bulkDelete, stripGroup, type Selection, type ContactFilter } from "@/lib/farming/contactsDb";
import type { FarmStatus } from "@/lib/types/farming";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Action = "setStatus" | "addGroup" | "moveGroup" | "delete" | "stripGroup";

// POST /api/farming/contacts/bulk
// { action, ids?: string[], filter?: ContactFilter, value?: string }
// `ids` targets an explicit set; `filter` targets EVERYTHING matching
// ("select all N matching") — one server-side UPDATE/DELETE over millions.
export async function POST(req: Request) {
  const gate = await requirePerm(req, "farming.manage"); if (gate) return gate;
  let body: { action?: Action; ids?: string[]; filter?: ContactFilter; value?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid body." }, { status: 400 }); }

  // stripGroup targets every contact carrying the group (no selection needed).
  if (body.action === "stripGroup") {
    if (!body.value) return Response.json({ ok: false, error: "value (groupId) required." }, { status: 400 });
    await stripGroup(body.value);
    return Response.json({ ok: true, affected: 0 });
  }

  const sel: Selection | null = body.ids?.length ? { ids: body.ids } : body.filter ? { filter: body.filter } : null;
  if (!sel) return Response.json({ ok: false, error: "Provide ids or a filter." }, { status: 400 });

  let affected = 0;
  switch (body.action) {
    case "setStatus":
      if (!body.value) return Response.json({ ok: false, error: "value (status) required." }, { status: 400 });
      affected = await bulkSetStatus(sel, body.value as FarmStatus); break;
    case "addGroup":
      if (!body.value) return Response.json({ ok: false, error: "value (groupId) required." }, { status: 400 });
      affected = await bulkAddGroup(sel, body.value); break;
    case "moveGroup":
      if (!body.value) return Response.json({ ok: false, error: "value (groupId) required." }, { status: 400 });
      affected = await bulkMoveGroup(sel, body.value); break;
    case "delete":
      affected = await bulkDelete(sel); break;
    default:
      return Response.json({ ok: false, error: "Unknown action." }, { status: 400 });
  }
  return Response.json({ ok: true, affected });
}
