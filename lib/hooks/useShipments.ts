"use client";
import { create } from "@/lib/hooks/zustand-shim";
import type { Shipment, ShipStatus, TrackEvent } from "@/lib/shipments/types";
import { FLOW, STATUS_LABEL } from "@/lib/shipments/types";

const past = (h: number) => { const d = new Date(); d.setHours(d.getHours() - h); return d.toISOString(); };
const future = (d: number) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString(); };
const ev = (ts: string, status: ShipStatus, location: string, note: string): TrackEvent => ({ ts, status, location, note });

const SEED: Shipment[] = [
  { id: "SH-8001", orderId: "ORD-10231", patientName: "Sarah Lin", patientId: "PT-1042", pharmacy: "Hallandale Pharmacy", carrier: "FedEx", trackingNumber: "7712 3456 7890", status: "out_for_delivery", shippedAt: past(40), estDelivery: future(0), notified: true, events: [ev(past(40), "label_created", "Hallandale, FL", "Shipping label created"), ev(past(30), "in_transit", "Ocala, FL", "Departed facility"), ev(past(4), "out_for_delivery", "Miami, FL", "On vehicle for delivery")] },
  { id: "SH-8002", orderId: "ORD-10230", patientName: "Michael Gromadzki", patientId: "PT-1039", pharmacy: "RXCompound Store", carrier: "UPS", trackingNumber: "1Z 999 AA1 01", status: "in_transit", shippedAt: past(20), estDelivery: future(2), notified: true, events: [ev(past(20), "label_created", "Phoenix, AZ", "Label created"), ev(past(10), "in_transit", "El Paso, TX", "In transit")] },
  { id: "SH-8003", orderId: "ORD-10228", patientName: "James Carter", patientId: "PT-1039", pharmacy: "Hallandale Pharmacy", carrier: "FedEx", trackingNumber: "7798 1122 3344", status: "delivered", shippedAt: past(96), estDelivery: past(24), notified: true, events: [ev(past(96), "label_created", "Hallandale, FL", "Label created"), ev(past(72), "in_transit", "Atlanta, GA", "In transit"), ev(past(24), "delivered", "New York, NY", "Delivered, left at front door")] },
  { id: "SH-8004", orderId: "ORD-10233", patientName: "Maria Gomez", patientId: "PT-1051", pharmacy: "RXCompound Store", carrier: "USPS", trackingNumber: "9400 1000 0000", status: "label_created", shippedAt: past(2), estDelivery: future(4), notified: false, events: [ev(past(2), "label_created", "Phoenix, AZ", "Shipping label created")] },
  { id: "SH-8005", orderId: "ORD-10225", patientName: "Derek Olsen", patientId: "PT-1060", pharmacy: "Hallandale Pharmacy", carrier: "FedEx", trackingNumber: "7755 6677 8899", status: "exception", shippedAt: past(50), estDelivery: past(2), notified: false, events: [ev(past(50), "label_created", "Hallandale, FL", "Label created"), ev(past(30), "in_transit", "Dallas, TX", "In transit"), ev(past(6), "exception", "Dallas, TX", "Delivery exception — address issue")] },
];

interface State {
  shipments: Shipment[];
  advance: (id: string) => void;
  markNotified: (id: string) => void;
}
export const useShipments = create<State>((set) => ({
  shipments: SEED,
  advance: (id) => set((s) => ({
    shipments: s.shipments.map((sh) => {
      if (sh.id !== id) return sh;
      const idx = FLOW.indexOf(sh.status as ShipStatus);
      if (idx < 0 || idx >= FLOW.length - 1) return sh;
      const next = FLOW[idx + 1];
      return { ...sh, status: next, events: [...sh.events, { ts: new Date().toISOString(), status: next, location: "—", note: STATUS_LABEL[next] }] };
    }),
  })),
  markNotified: (id) => set((s) => ({ shipments: s.shipments.map((sh) => sh.id === id ? { ...sh, notified: true } : sh) })),
}));
