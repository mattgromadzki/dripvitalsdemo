import { rateLimit } from "@/lib/security/ratelimit";
import { verifyOptOut } from "@/lib/farming/optout";
import { getContact, setOptedOutById } from "@/lib/farming/contactsDb";

export const dynamic = "force-dynamic";

function page(title: string, message: string, ok: boolean): Response {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;font-family:system-ui,-apple-system,Arial,sans-serif;background:#f6f8fb;color:#1a1a1a">
  <div style="max-width:460px;margin:12vh auto;padding:32px;background:#fff;border:1px solid #eaecef;border-radius:16px;text-align:center">
    <div style="font-size:40px;margin-bottom:8px">${ok ? "✅" : "⚠️"}</div>
    <h1 style="font-size:19px;margin:0 0 8px">${title}</h1>
    <p style="font-size:14px;color:#5b6672;line-height:1.5;margin:0">${message}</p>
  </div>
</body></html>`;
  return new Response(html, { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

// Public one-click email unsubscribe target (linked in every outbound email).
// GET /api/farming/unsubscribe?c=<contactId>&t=<hmac>
export async function GET(req: Request) {
  const limited = await rateLimit(req, "farming"); if (limited) return limited;
  const url = new URL(req.url);
  const contactId = url.searchParams.get("c") || "";
  const token = url.searchParams.get("t") || "";

  if (!contactId || !token || !verifyOptOut(contactId, token)) {
    return page("Invalid link", "This unsubscribe link is invalid or has expired. If you keep receiving messages, reply STOP or contact support.", false);
  }

  const c = await getContact(contactId);
  if (!c) {
    // Token was valid but the record is gone — treat as already removed.
    return page("You're unsubscribed", "You will no longer receive outreach messages from us.", true);
  }
  if (!c.optedOut) await setOptedOutById(contactId, true, "email");
  return page("You're unsubscribed", "You've been removed from our outreach list and won't receive further emails.", true);
}

// RFC 8058 one-click unsubscribe: Gmail/Yahoo POST here (body
// "List-Unsubscribe=One-Click") straight from the inbox, with no page render.
// Same signed token as the GET link; respond 200 on success.
export async function POST(req: Request) {
  const limited = await rateLimit(req, "farming"); if (limited) return limited;
  const url = new URL(req.url);
  const contactId = url.searchParams.get("c") || "";
  const token = url.searchParams.get("t") || "";
  if (!contactId || !token || !verifyOptOut(contactId, token)) {
    return new Response("Invalid link", { status: 400 });
  }
  const c = await getContact(contactId);
  if (c && !c.optedOut) await setOptedOutById(contactId, true, "email");
  return new Response("Unsubscribed", { status: 200 });
}
