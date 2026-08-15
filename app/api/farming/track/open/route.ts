import { verifyTrack } from "@/lib/farming/optout";
import { recordOpen } from "@/lib/farming/track";

export const dynamic = "force-dynamic";

// 1x1 transparent GIF (email open-tracking pixel).
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
function pixel(): Response {
  return new Response(new Uint8Array(PIXEL), { status: 200, headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache, must-revalidate, private", "Pragma": "no-cache" } });
}

// GET /api/farming/track/open?m=<campaignId>&c=<contactId>&t=<hmac>
// Always returns the pixel (never leak whether the token/campaign was valid).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const m = url.searchParams.get("m") || "";
  const c = url.searchParams.get("c") || "";
  const t = url.searchParams.get("t") || "";
  if (m && c && verifyTrack(m, c, t)) {
    try { await recordOpen(m, c); } catch { /* ignore */ }
  }
  return pixel();
}
