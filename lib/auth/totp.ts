import crypto from "crypto";

/**
 * TOTP (RFC 6238) implemented with Node crypto — no third-party auth dependency.
 * SHA-1, 30-second step, 6 digits — the defaults every authenticator app expects
 * (Google Authenticator, Authy, 1Password, etc.).
 */

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(s: string): Buffer {
  const clean = (s || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}

/** A fresh base32 secret (160 bits, recommended for TOTP). */
export function generateSecret(bytes = 20): string {
  return base32Encode(crypto.randomBytes(bytes));
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const bin = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return (bin % 1_000_000).toString().padStart(6, "0");
}

function timingEq(a: string, b: string): boolean {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  try { return crypto.timingSafeEqual(ba, bb); } catch { return false; }
}

/** Verify a 6-digit code, tolerating ±`window` steps of clock drift. */
export function verifyTotp(secret: string, token: string, window = 1): boolean {
  const t = (token || "").trim();
  if (!secret || !/^\d{6}$/.test(t)) return false;
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (let w = -window; w <= window; w++) {
    if (timingEq(hotp(secret, counter + w), t)) return true;
  }
  return false;
}

/** otpauth:// URI for QR provisioning. */
export function otpauthUrl(secret: string, account: string, issuer = "DripVitals"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: "6", period: "30" });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** One-time backup codes (shown once at enrollment). Format: xxxx-xxxx. */
export function generateBackupCodes(n = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < n; i++) {
    const raw = crypto.randomBytes(4).toString("hex");
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}`);
  }
  return codes;
}

/** Normalize a typed backup code (strip dashes/spaces, lowercase) for hashing/compare. */
export function normalizeBackupCode(code: string): string {
  return (code || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}
