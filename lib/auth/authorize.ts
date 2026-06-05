import { Redis } from "@upstash/redis";
import { verifyToken, type SessionClaims } from "@/lib/auth/serverCrypto";
import { DEFAULT_ROLE_PERMS } from "@/lib/rbac/permissions";

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function readCookie(req: Request, name: string): string | null {
  const c = req.headers.get("cookie") || "";
  const m = c.match(new RegExp("(?:^|; )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[1]) : null;
}

export function getSession(req: Request): SessionClaims | null {
  const t = readCookie(req, "dv_session");
  return t ? verifyToken(t) : null;
}

// Live role→permissions (honors edits made on the Roles & Access screen,
// which persist to "store:rbac"); falls back to the built-in defaults.
async function rolePermsFor(role: string): Promise<string[]> {
  const r = redis();
  if (r) {
    try {
      const v = await r.get("store:rbac");
      const map = (typeof v === "string" ? JSON.parse(v) : v) as Record<string, string[]> | null;
      if (map && Array.isArray(map[role])) return map[role];
    } catch { /* ignore */ }
  }
  return DEFAULT_ROLE_PERMS[role] || [];
}

export async function can(claims: SessionClaims | null, perm: string): Promise<boolean> {
  if (!claims) return false;
  if (claims.role === "owner") return true; // owner always has full access
  return (await rolePermsFor(claims.role)).includes(perm);
}

function deny(status: number, error: string): Response {
  return Response.json({ ok: false, error }, { status });
}

/** Returns null if the request is authenticated, else a 401 Response. */
export function requireAuth(req: Request): Response | null {
  return getSession(req) ? null : deny(401, "Sign in required.");
}

/** Returns null if the caller holds the permission, else a 401/403 Response. */
export async function requirePerm(req: Request, perm: string): Promise<Response | null> {
  const claims = getSession(req);
  if (!claims) return deny(401, "Sign in required.");
  if (!(await can(claims, perm))) return deny(403, "You don't have permission for this action.");
  return null;
}
