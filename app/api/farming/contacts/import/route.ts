import { requirePerm } from "@/lib/auth/authorize";
import { buildContact, bulkInsert } from "@/lib/farming/contactsDb";
import type { ContactInput } from "@/lib/types/farming";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_ROWS = 10000; // per chunk — the client streams the file in batches

// POST /api/farming/contacts/import  { rows: ContactInput[], groupId?: string }
// One chunk of an import. Builds contacts (server ids) and bulk-inserts with
// email dedupe (partial-unique index). Returns per-chunk counts; the client
// accumulates across chunks and shows progress.
export async function POST(req: Request) {
  const gate = await requirePerm(req, "farming.manage"); if (gate) return gate;
  let body: { rows?: ContactInput[]; groupId?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid body." }, { status: 400 }); }
  const rows = body.rows || [];
  if (!Array.isArray(rows) || !rows.length) return Response.json({ ok: true, inserted: 0, duplicates: 0 });
  if (rows.length > MAX_ROWS) return Response.json({ ok: false, error: `Chunk too large (max ${MAX_ROWS} rows).` }, { status: 413 });

  const contacts = rows
    .filter((r) => (r.email && r.email.trim()) || (r.phone && r.phone.trim())) // must be reachable
    .map((r) => buildContact({ ...r, source: r.source || "Import", groupIds: body.groupId ? [body.groupId] : r.groupIds }));

  const invalid = rows.length - contacts.length;
  const res = await bulkInsert(contacts);
  return Response.json({ ok: true, inserted: res.inserted, duplicates: res.duplicates, invalid });
}
