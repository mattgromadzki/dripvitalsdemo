import { requirePerm } from "@/lib/auth/authorize";
import { listContacts, type ContactFilter } from "@/lib/farming/contactsDb";
import type { FarmContact } from "@/lib/types/farming";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const HEADER = ["First", "Last", "Email", "Phone", "State", "County", "City", "Status", "Groups", "OptedOut", "Source", "Created"];
const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const row = (c: FarmContact) => [c.firstName, c.lastName, c.email, c.phone, c.custom?.state || "", c.custom?.county || "", c.custom?.city || "", c.status, (c.groupIds || []).join("; "), c.optedOut ? "yes" : "no", c.source || "", c.createdAt].map(q).join(",");

// GET /api/farming/contacts/export?filters → streamed CSV (pages the DB by
// keyset, so exporting millions never buffers the whole set in memory).
export async function GET(req: Request) {
  const gate = await requirePerm(req, "farming.manage"); if (gate) return gate;
  const url = new URL(req.url);
  const filter: ContactFilter = {
    search: url.searchParams.get("search") || undefined,
    status: url.searchParams.get("status") || undefined,
    group: url.searchParams.get("group") || undefined,
    state: url.searchParams.get("state") || undefined,
    county: url.searchParams.get("county") || undefined,
    city: url.searchParams.get("city") || undefined,
    includeSuppressed: url.searchParams.get("includeSuppressed") === "true",
  };
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(enc.encode(HEADER.join(",") + "\n"));
      let cursor: string | null = null;
      try {
        do {
          const page = await listContacts(filter, cursor, 1000);
          if (page.contacts.length) controller.enqueue(enc.encode(page.contacts.map(row).join("\n") + "\n"));
          cursor = page.nextCursor;
        } while (cursor);
      } catch { /* end the stream on error */ }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="farming_contacts_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
