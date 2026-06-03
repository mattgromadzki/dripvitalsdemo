import { emedSubmit } from "@/lib/pharmacy/emed";
import type { EmedOrderPayload } from "@/lib/pharmacy/types";

export async function POST(req: Request) {
  let payload: EmedOrderPayload;
  try { payload = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON body.", source: "emed" }, { status: 400 }); }
  if (!payload?.Patient || !Array.isArray(payload?.Drug) || payload.Drug.length === 0) {
    return Response.json({ ok: false, error: "Patient and at least one Drug are required.", source: "emed" }, { status: 400 });
  }
  const result = await emedSubmit(payload);
  return Response.json(result);
}
