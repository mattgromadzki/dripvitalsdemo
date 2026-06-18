import { getPatientSession } from "@/lib/auth/patientSession";
import { hasDb } from "@/lib/db/client";
import { dbGetDomain } from "@/lib/db/store";
import { STATUS_LABEL } from "@/lib/shipments/types";
import type { Shipment } from "@/lib/shipments/types";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function normalize(d: unknown): Shipment[] {
  if (Array.isArray(d)) return d as Shipment[];
  if (d && typeof d === "object" && Array.isArray((d as { shipments?: unknown }).shipments)) return (d as { shipments: Shipment[] }).shipments;
  return [];
}

async function readShipments(): Promise<Shipment[]> {
  try {
    if (hasDb()) return normalize(await dbGetDomain("shipments"));
    const r = redis();
    if (r) { const v = await r.get("store:shipments"); return normalize(typeof v === "string" ? JSON.parse(v) : v); }
  } catch { /* ignore */ }
  return [];
}

/** Build a public carrier tracking URL from carrier + number. */
function trackingUrl(carrier?: string, num?: string): string | undefined {
  const n = (num || "").replace(/\s+/g, "");
  if (!n) return undefined;
  const c = (carrier || "").toLowerCase();
  if (c.includes("fedex")) return `https://www.fedex.com/fedextrack/?trknbr=${n}`;
  if (c.includes("ups")) return `https://www.ups.com/track?loc=en_US&tracknum=${n}`;
  if (c.includes("usps")) return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`;
  if (c.includes("dhl")) return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${n}`;
  return `https://www.google.com/search?q=${encodeURIComponent(`${carrier || ""} ${n} tracking`)}`;
}

// Returns ONLY the signed-in patient's shipments, with a public tracking link.
export async function GET(req: Request) {
  const s = getPatientSession(req);
  if (!s) return new Response(JSON.stringify({ ok: false }), { status: 401, headers: { "Content-Type": "application/json" } });

  const all = await readShipments();
  const mine = all
    .filter((sh) => sh?.patientId === s.pid)
    .sort((a, b) => (b.shippedAt || "").localeCompare(a.shippedAt || ""));

  const shipments = mine.map((sh) => ({
    id: sh.id,
    status: sh.status,
    statusLabel: STATUS_LABEL[sh.status] || sh.status,
    carrier: sh.carrier,
    trackingNumber: sh.trackingNumber,
    trackingUrl: trackingUrl(sh.carrier, sh.trackingNumber),
    pharmacy: sh.pharmacy,
    shippedAt: sh.shippedAt,
    estDelivery: sh.estDelivery,
    events: (sh.events || []).map((e) => ({ ts: e.ts, status: e.status, location: e.location, note: e.note })),
  }));

  return Response.json({ ok: true, shipments });
}
