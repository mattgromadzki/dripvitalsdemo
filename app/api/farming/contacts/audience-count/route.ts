import { requirePerm } from "@/lib/auth/authorize";
import { audienceCount } from "@/lib/farming/contactsDb";
import type { FarmAudience, FarmChannel } from "@/lib/types/farming";

export const dynamic = "force-dynamic";

// POST /api/farming/contacts/audience-count { audience, channel } → reachable count
// Powers the campaign composer's live recipient count.
export async function POST(req: Request) {
  const gate = await requirePerm(req, "farming.manage"); if (gate) return gate;
  let body: { audience?: FarmAudience; channel?: FarmChannel };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid body." }, { status: 400 }); }
  if (!body.audience || !body.channel) return Response.json({ ok: false, error: "audience and channel required." }, { status: 400 });
  const count = await audienceCount(body.audience, body.channel);
  return Response.json({ ok: true, count });
}
