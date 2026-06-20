import { requireAuth } from "@/lib/auth/authorize";
import { greenstoneUpdateAddress } from "@/lib/pharmacy/greenstone";

export const dynamic = "force-dynamic";

// Update an order's shipping address: POST { orderId, address, city, state, zipCode, line2?, force?, note?, skip_validation? }
export async function POST(req: Request) {
  const gate = requireAuth(req);
  if (gate) return gate;

  let b: { orderId?: string | number; address?: string; city?: string; state?: string; zipCode?: string; line2?: string; force?: boolean; note?: string; skip_validation?: boolean };
  try { b = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 }); }

  if (b.orderId == null) return Response.json({ ok: false, error: "orderId is required." }, { status: 400 });
  if (!b.address?.trim() || !b.city?.trim() || !b.state?.trim() || !b.zipCode?.trim()) {
    return Response.json({ ok: false, error: "Street address, city, state, and ZIP are all required." }, { status: 400 });
  }

  const res = await greenstoneUpdateAddress(b.orderId, {
    address: b.address.trim(),
    city: b.city.trim(),
    state: b.state.trim().toUpperCase().slice(0, 2),
    zipCode: b.zipCode.trim(),
    line2: b.line2?.trim() || undefined,
    force: !!b.force,
    note: b.note?.trim() || undefined,
    skip_validation: !!b.skip_validation,
  });
  return Response.json(res, { status: res.ok ? 200 : 502 });
}
