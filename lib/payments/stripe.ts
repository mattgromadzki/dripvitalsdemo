import Stripe from "stripe";

let _stripe: Stripe | null = null;

/** Returns a configured Stripe client, or null when STRIPE_SECRET_KEY isn't set. */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!_stripe) _stripe = new Stripe(key);
  return _stripe;
}

export function stripeEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

/** Absolute base URL for success/cancel/return redirects. */
export function appUrl(req?: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (env) return env.replace(/\/$/, "");
  try { if (req) return new URL(req.url).origin; } catch { /* ignore */ }
  return "https://dripvitalsdemo.vercel.app";
}

/** Parse a price string like "$499" or "$299/mo" into integer cents. */
export function priceToCents(price: string | undefined): number {
  if (!price) return 0;
  const m = price.replace(/,/g, "").match(/(\d+(?:\.\d{1,2})?)/);
  return m ? Math.round(parseFloat(m[1]) * 100) : 0;
}
