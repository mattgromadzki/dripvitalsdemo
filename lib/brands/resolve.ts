/**
 * Resolve which brand an incoming order/request/email belongs to.
 *
 * Priority: explicit brandId  →  request host (each brand's domain)  →  intake
 * form slug  →  default brand. Always resolves to a real brand id.
 */
import { BRANDS, DEFAULT_BRAND_ID, getBrand, isBrandId, type Brand } from "./registry";

/** Map a hostname (e.g. "www.vitalsrx.com" or "vitalsrx.com:443") to a brand id. */
export function brandFromHost(host?: string | null): string | null {
  if (!host) return null;
  const h = host.toLowerCase().split(":")[0].trim();
  for (const b of Object.values(BRANDS)) {
    if (b.domains.some((d) => h === d || h.endsWith("." + d))) return b.id;
  }
  return null;
}

/** Map an intake-form slug to the brand it's assigned to. */
export function brandFromIntakeSlug(slug?: string | null): string | null {
  if (!slug) return null;
  const m = Object.values(BRANDS).find((b) => b.intakeFormSlug === slug);
  return m ? m.id : null;
}

export interface ResolveBrandInput {
  /** Explicit brand id (e.g. stamped on the intake form or order). */
  brandId?: string | null;
  /** Request host header / window.location.host. */
  host?: string | null;
  /** Intake form slug. */
  slug?: string | null;
}

/** Resolve to a brand id, defaulting to DripVitals when nothing matches. */
export function resolveBrandId(input: ResolveBrandInput = {}): string {
  if (isBrandId(input.brandId)) return input.brandId;
  return (
    brandFromHost(input.host) ||
    brandFromIntakeSlug(input.slug) ||
    DEFAULT_BRAND_ID
  );
}

/** Resolve the full brand from a server Request (Host header + ?brand= override). */
export function resolveBrandFromRequest(req: Request): Brand {
  let override: string | null = null;
  try { override = new URL(req.url).searchParams.get("brand"); } catch { /* ignore */ }
  const host = req.headers.get("host");
  return getBrand(resolveBrandId({ brandId: override, host }));
}
