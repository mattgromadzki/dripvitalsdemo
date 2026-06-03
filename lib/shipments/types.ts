export type ShipStatus = "label_created" | "in_transit" | "out_for_delivery" | "delivered" | "exception";
export interface TrackEvent { ts: string; status: ShipStatus; location: string; note: string; }
export interface Shipment {
  id: string; orderId: string; patientName: string; patientId?: string;
  pharmacy: string; carrier: "FedEx" | "UPS" | "USPS"; trackingNumber: string;
  status: ShipStatus; shippedAt: string; estDelivery: string; notified: boolean; events: TrackEvent[];
}
export const FLOW: ShipStatus[] = ["label_created", "in_transit", "out_for_delivery", "delivered"];
export const STATUS_LABEL: Record<ShipStatus, string> = { label_created: "Label created", in_transit: "In transit", out_for_delivery: "Out for delivery", delivered: "Delivered", exception: "Exception" };
export function trackingUrl(c: Shipment["carrier"], n: string) {
  return c === "FedEx" ? `https://www.fedex.com/fedextrack/?trknbr=${n}` : c === "UPS" ? `https://www.ups.com/track?tracknum=${n}` : `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`;
}
