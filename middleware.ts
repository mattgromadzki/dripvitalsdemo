import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Dedicated patient hostnames. On these, the patient app lives at the root and
// sign-in at /login. (patient.dripvitals.com is the new canonical host; the
// older portal.dripvitals.com is kept as an alias.) Add other brands here later.
const PATIENT_HOSTS = new Set([
  "patient.dripvitals.com",
  "portal.dripvitals.com",
]);

// Signed, HttpOnly patient session cookie (set by /api/patient/login). Presence
// is enough to route on; the signature is verified server-side by the patient
// APIs, and the app self-corrects a forged/expired cookie by bouncing to login.
const SESSION_COOKIE = "dv_patient";

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const path = url.pathname;
  const host = (req.headers.get("host") || "").toLowerCase().split(":")[0];
  const authed = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  const hasResetFlow = url.searchParams.has("reset") || url.searchParams.has("setpw");

  const redirectTo = (pathname: string) => {
    const d = url.clone(); d.pathname = pathname; return NextResponse.redirect(d);
  };
  const rewriteTo = (pathname: string) => {
    const d = url.clone(); d.pathname = pathname; return NextResponse.rewrite(d);
  };

  // ── Patient subdomain: /login = patient sign-in, "/" = the app ────────────
  if (PATIENT_HOSTS.has(host)) {
    // Fold internal/legacy paths back onto the clean public URLs.
    if (path === "/patient" || path === "/patient/login" || path === "/patient-portal") {
      if (hasResetFlow) return redirectTo("/login");
      return redirectTo(authed ? "/" : "/login");
    }
    if (path === "/login") {
      if (authed && !hasResetFlow) return redirectTo("/");
      return rewriteTo("/patient/login"); // render patient sign-in at /login
    }
    if (path === "/") {
      if (!authed) return redirectTo("/login");
      return rewriteTo("/patient"); // render the app at the root
    }
    return NextResponse.next();
  }

  // ── Other hosts (staff app.dripvitals.com, *.vercel.app previews) ─────────
  // The staff /login and "/" are left untouched. The patient app stays reachable
  // at the namespaced /patient + /patient/login (handy for previews/testing).
  if ((path === "/patient" || path.startsWith("/patient/")) && path !== "/patient/login") {
    if (!authed) return redirectTo("/patient/login");
  }
  if (path === "/patient/login" && authed && !hasResetFlow) {
    return redirectTo("/patient");
  }
  if (path === "/patient-portal") {
    if (hasResetFlow) return redirectTo("/patient/login");
    return redirectTo(authed ? "/patient" : "/patient/login");
  }

  return NextResponse.next();
}

// APIs and static assets are not matched, so they pass through on every host.
export const config = {
  matcher: ["/", "/login", "/patient", "/patient/:path*", "/patient-portal"],
};
