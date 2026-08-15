import { requirePerm } from "@/lib/auth/authorize";
import { readDomain, writeDomain } from "@/lib/farming/serverStore";
import { dispatchDueCampaigns } from "@/lib/farming/dispatch";
import type { FarmCampaign } from "@/lib/types/farming";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CAMPAIGNS = "farming-campaigns";
type Action = "send" | "schedule" | "pause" | "resume" | "cancel";

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
function resetProgress(c: FarmCampaign) {
  c.recipientSnapshot = undefined; c.cursor = 0; c.results = {};
  c.sent = 0; c.delivered = 0; c.failed = 0; c.totalRecipients = 0;
  c.startedAt = undefined; c.completedAt = undefined;
}

// POST /api/farming/campaigns/:id  { action, scheduledAt?, throttlePerMin?, campaign? }
// Authoritative campaign lifecycle. Upserts the provided campaign (so a just-created
// draft is guaranteed present server-side), applies the action, and for "send" runs
// one dispatch batch inline for instant feedback (the cron drains the rest).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requirePerm(req, "farming.manage"); if (gate) return gate;
  const { id } = await ctx.params;
  let body: { action?: Action; scheduledAt?: string; throttlePerMin?: number; campaign?: FarmCampaign };
  try { body = await req.json(); } catch { return json({ ok: false, error: "Invalid body." }, 400); }
  const action = body.action;
  if (!action) return json({ ok: false, error: "action is required." }, 400);

  const campaigns = (await readDomain<FarmCampaign[]>(CAMPAIGNS)) || [];
  let idx = campaigns.findIndex((c) => c.id === id);
  if (idx === -1 && body.campaign && body.campaign.id === id) { campaigns.unshift(body.campaign); idx = 0; }
  else if (idx !== -1 && body.campaign) { campaigns[idx] = { ...campaigns[idx], ...body.campaign }; }
  if (idx === -1) return json({ ok: false, error: "Campaign not found." }, 404);
  const c = campaigns[idx];

  const now = Date.now();
  switch (action) {
    case "schedule": {
      const when = Date.parse(body.scheduledAt || "");
      if (!when) return json({ ok: false, error: "A valid scheduledAt is required." }, 400);
      resetProgress(c);
      c.status = "scheduled"; c.scheduledAt = new Date(when).toISOString();
      if (body.throttlePerMin) c.throttlePerMin = body.throttlePerMin;
      break;
    }
    case "send": {
      resetProgress(c);
      c.status = "scheduled"; c.scheduledAt = new Date(now).toISOString();
      if (body.throttlePerMin) c.throttlePerMin = body.throttlePerMin;
      break;
    }
    case "pause":  c.status = "paused"; break;
    case "resume": c.status = "scheduled"; c.scheduledAt = c.scheduledAt || new Date(now).toISOString(); break;
    case "cancel": c.status = "canceled"; break;
    default: return json({ ok: false, error: "Unknown action." }, 400);
  }

  await writeDomain(CAMPAIGNS, campaigns);

  // "send" (and a due "resume") kick off one batch immediately so the user sees
  // progress without waiting for the next cron tick.
  let dispatch = null;
  if (action === "send" || action === "resume") {
    dispatch = await dispatchDueCampaigns({ campaignId: id, now: Date.now() });
  }

  const updated = ((await readDomain<FarmCampaign[]>(CAMPAIGNS)) || []).find((x) => x.id === id) || c;
  return json({ ok: true, campaign: updated, dispatch });
}
