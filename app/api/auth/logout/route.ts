export const dynamic = "force-dynamic";

export async function POST() {
  const res = new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  res.headers.append("Set-Cookie", "dv_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0");
  return res;
}
