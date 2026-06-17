import { requirePerm } from "@/lib/auth/authorize";
import { hasDb } from "@/lib/db/client";
import { dbPing } from "@/lib/db/store";
import { signalsEnabled } from "@/lib/realtime/signal";
import { listBrands } from "@/lib/brands/registry";
import { getEmailCreds, getSmsCreds } from "@/lib/integrations/store";

export const dynamic = "force-dynamic";

const has = (...keys: string[]) => keys.every((k) => !!process.env[k]);
const any = (...keys: string[]) => keys.some((k) => !!process.env[k]);

// GET /api/readiness — a launch-readiness snapshot. Reports which integrations
// are configured/live without ever returning secret values.
export async function GET(req: Request) {
  const gate = await requirePerm(req, "settings.manage");
  if (gate) return gate;

  const dbConfigured = hasDb();
  const dbOk = dbConfigured ? await dbPing() : false;

  const brands = listBrands().map((b) => {
    const ec = getEmailCreds(b.id);
    const sc = getSmsCreds(b.id);
    const sfx = b.envKey ? `_${b.envKey}` : "";
    return {
      id: b.id, name: b.name,
      email: !!ec.apiKey, sms: !!(sc.accountSid && sc.authToken),
      emailEnv: `SENDGRID_API_KEY${sfx}`, smsEnv: `TWILIO_ACCOUNT_SID${sfx}`,
    };
  });

  const provider = (process.env.PAYMENTS_PROVIDER || "").toLowerCase();
  let payments = { provider: provider || null, ready: false, detail: "No payment provider configured", env: ["PAYMENTS_PROVIDER"] as string[] };
  if (provider === "corepay") payments = { provider, ready: has("COREPAY_API_KEY", "COREPAY_CLIENT_ID", "COREPAY_MID_USD"), detail: "CorePay (NetValve)", env: ["COREPAY_API_KEY", "COREPAY_CLIENT_ID", "COREPAY_MID_USD", "COREPAY_WEBHOOK_SECRET"] };
  else if (provider === "stripe") payments = { provider, ready: has("STRIPE_SECRET_KEY"), detail: "Stripe", env: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] };
  else if (provider === "square") payments = { provider, ready: has("SQUARE_ACCESS_TOKEN", "SQUARE_LOCATION_ID"), detail: "Square", env: ["SQUARE_ACCESS_TOKEN", "SQUARE_LOCATION_ID"] };

  const lifefile = has("LIFEFILE_API_USER", "LIFEFILE_API_PASS", "LIFEFILE_API_BASE");
  const emed = has("EMED_USERNAME", "EMED_PASSWORD", "EMED_BASE_URL");
  const greenstone = has("GREENSTONE_API_TOKEN");

  return Response.json({
    ok: true,
    db: { configured: dbConfigured, ok: dbOk },
    redis: signalsEnabled(),
    brands,
    payments,
    pharmacy: { ready: lifefile || emed || greenstone, which: greenstone ? "GreenstoneRX (5Axis)" : lifefile ? "LifeFile" : emed ? "eMed" : null, env: ["GREENSTONE_API_TOKEN", "GREENSTONE_PHARMACY_NCPDPID", "GREENSTONE_CLINIC"] },
    address: { ready: has("SMARTY_AUTH_ID", "SMARTY_AUTH_TOKEN"), env: ["SMARTY_AUTH_ID", "SMARTY_AUTH_TOKEN"] },
    shipping: { ready: has("USPS_CLIENT_ID", "USPS_CLIENT_SECRET"), env: ["USPS_CLIENT_ID", "USPS_CLIENT_SECRET"] },
    sentry: any("SENTRY_DSN"),
    authSecret: has("AUTH_SECRET"),
    appUrl: any("APP_URL", "NEXT_PUBLIC_APP_URL"),
    cron: has("CRON_SECRET"),
    demoData: process.env.NEXT_PUBLIC_SEED_DEMO_DATA !== "false",
  });
}
