import { requirePerm } from "@/lib/auth/authorize";
import { sendEmail } from "@/lib/email/provider";
import { getBrand } from "@/lib/brands/registry";

// POST /api/brands/test { brandId, to } → sends a test email FROM that brand's
// domain via its own SendGrid registration, so staff can verify each brand's
// sending setup. Returns the provider result ("mock" when no live key yet).
export async function POST(req: Request) {
  const gate = await requirePerm(req, "email.send");
  if (gate) return gate;

  let body: { brandId?: string; to?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid body." }, { status: 400 }); }
  if (!body?.to) return Response.json({ ok: false, error: "Recipient email is required." }, { status: 400 });

  const brand = getBrand(body.brandId);
  const subject = `Test email from ${brand.name}`;
  const html =
    `<p>This is a test message from <b>${brand.name}</b>.</p>` +
    `<p>If it arrived from <b>${brand.from}</b> and landed in the inbox, ${brand.name}'s sending domain and SendGrid registration are wired up correctly.</p>` +
    `<p>— The ${brand.name} Care Team</p>`;

  const res = await sendEmail({ to: body.to, subject, html }, brand.id);
  return Response.json(res);
}
