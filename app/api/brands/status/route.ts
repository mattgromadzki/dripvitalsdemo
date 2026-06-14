import { requirePerm } from "@/lib/auth/authorize";
import { listBrands, DEFAULT_BRAND_ID } from "@/lib/brands/registry";
import { getEmailCreds, getSmsCreds } from "@/lib/integrations/store";

// GET /api/brands/status → for each brand: public config + whether its (separate)
// SendGrid/Twilio registration resolves to live credentials. No secrets are
// returned — only booleans, the from-addresses, and the env-var NAMES to set.
export async function GET(req: Request) {
  const gate = await requirePerm(req, "settings.manage");
  if (gate) return gate;

  const brands = listBrands().map((b) => {
    const ec = getEmailCreds(b.id);
    const sc = getSmsCreds(b.id);
    const sfx = b.envKey ? `_${b.envKey}` : "";
    return {
      id: b.id,
      name: b.name,
      slug: b.slug,
      isDefault: b.id === DEFAULT_BRAND_ID,
      domains: b.domains,
      from: ec.from || b.from,
      supportEmail: b.supportEmail,
      intakeFormSlug: b.intakeFormSlug ?? null,
      pharmacyId: b.pharmacyId,
      theme: b.theme,
      email: { provider: ec.provider, configured: !!ec.apiKey, from: ec.from || b.from },
      sms: { provider: sc.provider, configured: !!(sc.accountSid && sc.authToken), from: sc.from ?? null },
      env: {
        sendgridKey: `SENDGRID_API_KEY${sfx}`,
        emailFrom: `EMAIL_FROM${sfx}`,
        twilioSid: `TWILIO_ACCOUNT_SID${sfx}`,
        twilioToken: `TWILIO_AUTH_TOKEN${sfx}`,
        twilioFrom: `TWILIO_FROM${sfx}`,
      },
    };
  });

  return Response.json({ brands });
}
