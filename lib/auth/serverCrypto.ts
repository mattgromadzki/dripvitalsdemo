import crypto from "crypto";

// Secret used to sign session tokens. Set AUTH_SECRET on Vercel for real security;
// the fallback only exists so the demo runs without configuration.
const SECRET = process.env.AUTH_SECRET || "dripvitals-dev-secret-change-me";

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = (stored || "").split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 32).toString("hex");
  try { return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(candidate, "hex")); } catch { return false; }
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface SessionClaims { email: string; name: string; role: string; exp: number; }

export function signToken(claims: SessionClaims): string {
  const payload = b64url(JSON.stringify(claims));
  const sig = b64url(crypto.createHmac("sha256", SECRET).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifyToken(token: string): SessionClaims | null {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expected = b64url(crypto.createHmac("sha256", SECRET).update(payload).digest());
  try { if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null; } catch { return null; }
  try {
    const claims = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()) as SessionClaims;
    if (!claims.exp || claims.exp < Date.now()) return null;
    return claims;
  } catch { return null; }
}
