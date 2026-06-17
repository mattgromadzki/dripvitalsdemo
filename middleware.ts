import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Patient-facing hostnames that should land on the patient portal at their root,
// instead of the staff app's default redirect to /dashboard.
const PORTAL_HOSTS = new Set([
  "portal.dripvitals.com",
  // add other brands' patient hosts here later, e.g. "my.dripvitals.com"
]);

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").toLowerCase().split(":")[0];
  if (PORTAL_HOSTS.has(host)) {
    const url = req.nextUrl.clone();
    url.pathname = "/patient-portal"; // query string (e.g. ?setpw=) is preserved
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

// Only runs on the root request. The portal page, APIs, and static assets all
// pass through untouched, so /api/patient/* and /patient-portal keep working
// on every hostname.
export const config = { matcher: ["/"] };
