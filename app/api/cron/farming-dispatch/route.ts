import { dispatchDueCampaigns } from "@/lib/farming/dispatch";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Runs every minute (Vercel Cron, Pro plan). Processes due scheduled farming
// campaigns — one throttled batch per campaign per run — so scheduled sends fire
// close to their time and large lists drain across successive runs. Gated by
// CRON_SECRET (Vercel sends it automatically); leaving it unset would make this
// publicly invocable, so CRON_SECRET must be set in the environment.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const summary = await dispatchDueCampaigns({ now: Date.now() });
  return Response.json({ ok: true, ...summary });
}
