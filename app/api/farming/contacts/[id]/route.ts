import { requirePerm } from "@/lib/auth/authorize";
import { updateContactFields, bulkDelete } from "@/lib/farming/contactsDb";
import type { FarmContact } from "@/lib/types/farming";

export const dynamic = "force-dynamic";

// PATCH /api/farming/contacts/:id  { patch: Partial<FarmContact> } → update one
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requirePerm(req, "farming.manage"); if (gate) return gate;
  const { id } = await ctx.params;
  let body: { patch?: Partial<FarmContact> };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid body." }, { status: 400 }); }
  const updated = await updateContactFields(id, body.patch || {});
  if (!updated) return Response.json({ ok: false, error: "Contact not found." }, { status: 404 });
  return Response.json({ ok: true, contact: updated });
}

// DELETE /api/farming/contacts/:id
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requirePerm(req, "farming.manage"); if (gate) return gate;
  const { id } = await ctx.params;
  const n = await bulkDelete({ ids: [id] });
  return Response.json({ ok: true, deleted: n });
}
