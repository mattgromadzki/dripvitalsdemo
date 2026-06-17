/**
 * Multi-brand registry.
 *
 * DripVitals runs one EMR behind several consumer brands. Every brand shares the
 * same provider workflow and (for now) the same fulfillment pharmacy, but each
 * has its OWN marketing domain, its OWN intake form, and — critically — its OWN
 * SendGrid + Twilio registration, so patient confirmations are sent FROM that
 * brand's domain/number.
 *
 * Per the current plan:
 *  - Patient records are SEPARATE per brand (a patient belongs to exactly one brand).
 *  - Each brand has a separate SendGrid + Twilio account (separate API keys/creds).
 *  - Fulfillment stays under DripVitals for all brands (pharmacyId = "dripvitals").
 *
 * To add a brand: add an entry here + set its env vars on the host (see `envKey`).
 * Nothing else in the app needs to hard-code a brand.
 */

export interface BrandTheme {
  /** Primary brand color (hex). */
  brand: string;
  /** Optional accent color (hex). */
  accent?: string;
}

export interface Brand {
  /** Stable internal id, also stored on patient/order records. */
  id: string;
  /** Display name — used as {{clinic}} in templates and the email "from" name. */
  name: string;
  /** URL/store slug. */
  slug: string;
  /** Hostnames that route to this brand (used to resolve brand from a request). */
  domains: string[];
  /**
   * Env-var suffix for this brand's SendGrid/Twilio creds, e.g. "VITALSRX" →
   * SENDGRID_API_KEY_VITALSRX, EMAIL_FROM_VITALSRX, TWILIO_ACCOUNT_SID_VITALSRX,
   * TWILIO_AUTH_TOKEN_VITALSRX, TWILIO_FROM_VITALSRX.
   * `null` means use the base env names (SENDGRID_API_KEY, EMAIL_FROM, …) — the
   * default brand, so existing config keeps working unchanged.
   */
  envKey: string | null;
  /** Default email "from" (used when EMAIL_FROM[_SUFFIX] is unset). */
  from: string;
  /** Optional reply-to. */
  replyTo?: string;
  /** Support address shown to patients. */
  supportEmail: string;
  /** Patient portal URL for this brand. */
  portalUrl: string;
  /** Default intake-form slug for this brand (the "assigned intake form"). */
  intakeFormSlug?: string;
  /** Fulfillment pharmacy id. All brands route to DripVitals' pharmacy for now. */
  pharmacyId: string;
  /** Brand theme tokens for UI (intake form / portal). */
  theme: BrandTheme;
}

export const DEFAULT_BRAND_ID = "dripvitals";

export const BRANDS: Record<string, Brand> = {
  dripvitals: {
    id: "dripvitals",
    name: "DripVitals",
    slug: "dripvitals",
    domains: ["dripvitals.com", "www.dripvitals.com", "app.dripvitals.com"],
    envKey: null, // uses base SENDGRID_API_KEY / EMAIL_FROM / TWILIO_* (backwards compatible)
    from: "DripVitals <care@dripvitals.com>",
    replyTo: "care@dripvitals.com",
    supportEmail: "care@dripvitals.com",
    portalUrl: "https://portal.dripvitals.com",
    intakeFormSlug: "glp1-eligibility",
    pharmacyId: "dripvitals",
    theme: { brand: "#2C7C9E", accent: "#6FB6CE" },
  },
  vitalsrx: {
    id: "vitalsrx",
    name: "VitalsRX",
    slug: "vitalsrx",
    domains: ["vitalsrx.com", "www.vitalsrx.com"],
    envKey: "VITALSRX",
    from: "VitalsRX <care@vitalsrx.com>",
    replyTo: "care@vitalsrx.com",
    supportEmail: "care@vitalsrx.com",
    portalUrl: "https://app.dripvitals.com/patient-portal",
    intakeFormSlug: "vitalsrx-intake",
    pharmacyId: "dripvitals",
    theme: { brand: "#1E7A50", accent: "#4FBF8B" },
  },
  skinnyshotsrx: {
    id: "skinnyshotsrx",
    name: "SkinnyShotsRX",
    slug: "skinnyshotsrx",
    domains: ["skinnyshotsrx.com", "www.skinnyshotsrx.com"],
    envKey: "SKINNYSHOTSRX",
    from: "SkinnyShotsRX <care@skinnyshotsrx.com>",
    replyTo: "care@skinnyshotsrx.com",
    supportEmail: "care@skinnyshotsrx.com",
    portalUrl: "https://app.dripvitals.com/patient-portal",
    intakeFormSlug: "skinnyshots-intake",
    pharmacyId: "dripvitals",
    theme: { brand: "#C2185B", accent: "#F06292" },
  },
};

/** Resolve a brand by id, falling back to the default brand. Never returns null. */
export function getBrand(id?: string | null): Brand {
  return (id && BRANDS[id]) || BRANDS[DEFAULT_BRAND_ID];
}

/** All brands, default first. */
export function listBrands(): Brand[] {
  const all = Object.values(BRANDS);
  return [getBrand(DEFAULT_BRAND_ID), ...all.filter((b) => b.id !== DEFAULT_BRAND_ID)];
}

/** True if the id maps to a known brand. */
export function isBrandId(id?: string | null): id is string {
  return !!id && !!BRANDS[id];
}
