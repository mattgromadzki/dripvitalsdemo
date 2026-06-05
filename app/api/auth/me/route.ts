import { verifyToken } from "@/lib/auth/serverCrypto";

export const dynamic = "force-dynamic";

function readCookie(req: Request, name: string): string | null {
  const c = req.headers.get("cookie") || "";
  const m = c.match(new RegExp("(?:^|; )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[1]) : null;
}

export async function GET(req: Request) {
  const token = readCookie(req, "dv_session");
  const claims = token ? verifyToken(token) : null;
  if (!claims) return new Response(JSON.stringify({ ok: false }), { status: 401, headers: { "Content-Type": "application/json" } });
  return Response.json({ ok: true, user: { email: claims.email, name: claims.name, role: claims.role } });
}
