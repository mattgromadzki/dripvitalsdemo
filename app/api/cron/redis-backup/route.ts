import { runBackup } from "@/lib/backup/redisBackup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Daily backup of the entire Upstash Redis store (all EMR/app data) into the
// Neon `redis_backups` table. Vercel Cron calls this; gated by CRON_SECRET.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  try {
    const res = await runBackup();
    return Response.json({ ok: true, ...res });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
