import { verifyTrack } from "@/lib/farming/optout";
import { recordClick } from "@/lib/farming/track";

export const dynamic = "force-dynamic";

const FALLBACK = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app.dripvitals.com").replace(/\/+$/, "");

// GET /api/farming/track/click?m=&c=&t=&u=<encoded target>
// Records the click, then 302-redirects to the original URL. Only http(s)
// targets are honored (no open-redirect to javascript:/data: schemes).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const m = url.searchParams.get("m") || "";
  const c = url.searchParams.get("c") || "";
  const t = url.searchParams.get("t") || "";
  const target = url.searchParams.get("u") || "";

  let dest = FALLBACK;
  try { const u = new URL(target); if (u.protocol === "http:" || u.protocol === "https:") dest = u.toString(); } catch { /* keep fallback */ }

  if (m && c && verifyTrack(m, c, t)) {
    try { await recordClick(m, c); } catch { /* ignore */ }
  }
  return Response.redirect(dest, 302);
}
