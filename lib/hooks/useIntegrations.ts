"use client";

import { create } from "@/lib/hooks/zustand-shim";
import type { Integration, Webhook, IntegrationStatus } from "@/lib/types";
import { INTEGRATIONS as INT_SEED, WEBHOOKS as WH_SEED } from "@/lib/data/integrations";

interface IntegrationsState {
  integrations: Integration[];
  webhooks: Webhook[];
  setStatus: (id: string, status: IntegrationStatus) => void;
  reconnect: (id: string) => void;
  disconnect: (id: string) => void;
  toggleWebhook: (id: string) => void;
  removeWebhook: (id: string) => void;
}

export const useIntegrations = create<IntegrationsState>((set) => ({
  integrations: INT_SEED,
  webhooks: WH_SEED,
  setStatus: (id, status) => {
    set((s) => ({
      integrations: s.integrations.map((i) => (i.id === id ? { ...i, status } : i)),
    }));
  },
  reconnect: (id) => {
    set((s) => ({
      integrations: s.integrations.map((i) =>
        i.id === id
          ? { ...i, status: "connected" as const, errorMessage: undefined, lastSync: "Just now" }
          : i
      ),
    }));
  },
  disconnect: (id) => {
    set((s) => ({
      integrations: s.integrations.map((i) =>
        i.id === id
          ? { ...i, status: "disconnected" as const, lastSync: undefined }
          : i
      ),
    }));
  },
  toggleWebhook: (id) => {
    set((s) => ({
      webhooks: s.webhooks.map((w) => (w.id === id ? { ...w, isActive: !w.isActive } : w)),
    }));
  },
  removeWebhook: (id) => {
    set((s) => ({ webhooks: s.webhooks.filter((w) => w.id !== id) }));
  },
}));
