import { requireAuth } from "@/lib/auth/authorize";

export const dynamic = "force-dynamic";

// Reports whether the GreenstoneRX (5Axis) connector is configured in THIS
// deployment, reading env server-side. The token is masked. Used by the
// Integrations connection panel so staff can see config before testing.
export async function GET(req: Request) {
  const gate = requireAuth(req);
  if (gate) return gate;

  const token = (process.env.GREENSTONE_API_TOKEN || "").trim();
  const baseUrl = (process.env.GREENSTONE_BASE_URL || "https://sandbox-pharmacy.5axis.health").trim();
  return Response.json({
    ok: true,
    configured: !!token,
    live: !!token,
    sandbox: !baseUrl.includes("//pharmacy.5axis.health"),
    clinic: process.env.GREENSTONE_CLINIC || "",
    ncpdpid: process.env.GREENSTONE_PHARMACY_NCPDPID || "",
    baseUrl,
    webhookConfigured: !!(process.env.GREENSTONE_WEBHOOK_SECRET || "").trim(),
    tokenMasked: token ? `${token.slice(0, 7)}…${token.slice(-4)}` : "",
  });
}
