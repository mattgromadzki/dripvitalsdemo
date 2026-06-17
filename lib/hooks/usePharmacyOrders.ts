"use client";
import { create } from "@/lib/hooks/zustand-shim";
import type { EmedRxRef } from "@/lib/pharmacy/types";

// Maps our fulfillment order id -> what was sent to a pharmacy connector.
export interface SentOrder {
  connector: "emed" | "lifefile" | "greenstone";
  pharmacyName: string;
  orderId: number | string;   // eMed OrderId or Life File order ref
  internalRxIds: number[];   // our system-wide internal Rx IDs (10001+)
  rx: EmedRxRef[];            // eMed only
  message?: string;          // Life File success message
  sentAt: string;
}
interface State {
  byOrder: Record<string, SentOrder>;
  setSent: (orderId: string, sent: SentOrder) => void;
  clear: (orderId: string) => void;
}
export const usePharmacyOrders = create<State>((set) => ({
  byOrder: {},
  setSent: (orderId, sent) => set((s) => ({ byOrder: { ...s.byOrder, [orderId]: sent } })),
  clear: (orderId) => set((s) => { const n = { ...s.byOrder }; delete n[orderId]; return { byOrder: n }; }),
}));
