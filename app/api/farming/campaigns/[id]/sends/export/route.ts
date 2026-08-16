import { requirePerm } from "@/lib/auth/authorize";
import { listSends } from "@/lib/farming/sendsDb";
import { getContact } from "@/lib/farming/contactsDb";

export const dynamic = "force-dynamic";

const HEADER = ["Name", "Email", "Status", "Sent", "Delivered", "Opened", "Clicked", "Replied", "Bounced", "Unsubscribed"];
const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

// GET /api/farming/campaigns/:id/sends/export → streamed CSV of every recipient
// outcome for a campaign (pages the DB by offset, so large campaigns don't buffer).
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requirePerm(req, "farming.manage"); if (gate) return gate;
  const { id } = await ctx.params;
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(enc.encode(HEADER.join(",") + "\n"));
      let offset = 0; const PAGE = 500;
      for (;;) {
        const rows = await listSends(id, offset, PAGE, "all");
        if (!rows.length) break;
        for (const s of rows) {
          const c = await getContact(s.contactId);
          const name = c ? [c.firstName, c.lastName].filter(Boolean).join(" ") || "" : "";
          const line = [name, c?.email || "", s.status, s.sentAt || "", s.deliveredAt || "", s.openedAt || "", s.clickedAt || "", s.repliedAt || "", s.bouncedAt || "", s.unsubscribedAt || ""].map(q).join(",");
          controller.enqueue(enc.encode(line + "\n"));
        }
        if (rows.length < PAGE) break;
        offset += PAGE;
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="campaign-${id}-report.csv"` } });
}
