"use client";

import { create } from "@/lib/hooks/zustand-shim";
import type { Campaign, Automation, MessageTemplate, AudienceSegment, CampaignStatus } from "@/lib/types";
import {
  CAMPAIGNS as CAMP_SEED,
  AUTOMATIONS as AUT_SEED,
  MESSAGE_TEMPLATES as TPL_SEED,
  AUDIENCE_SEGMENTS as SEG_SEED,
} from "@/lib/data/marketing";

interface MarketingState {
  campaigns: Campaign[];
  automations: Automation[];
  templates: MessageTemplate[];
  segments: AudienceSegment[];
  addCampaign: (c: Omit<Campaign, "id">) => Campaign;
  setCampaignStatus: (id: string, status: CampaignStatus) => void;
  duplicateCampaign: (id: string) => Campaign | null;
  removeCampaign: (id: string) => void;
  toggleAutomation: (id: string) => void;
}

let campaignSeq = CAMP_SEED.length + 1;
function nextCampaignId(): string {
  return `CMP-${String(campaignSeq++).padStart(3, "0")}`;
}

export const useMarketing = create<MarketingState>((set) => ({
  campaigns: CAMP_SEED,
  automations: AUT_SEED,
  templates: TPL_SEED,
  segments: SEG_SEED,
  addCampaign: (input) => {
    const created: Campaign = { id: nextCampaignId(), ...input };
    set((s) => ({ campaigns: [created, ...s.campaigns] }));
    return created;
  },
  setCampaignStatus: (id, status) => {
    set((s) => ({
      campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, status } : c)),
    }));
  },
  duplicateCampaign: (id) => {
    const src = useMarketing.getState().campaigns.find((c) => c.id === id);
    if (!src) return null;
    // Clone as a fresh draft with zeroed performance metrics.
    const copy: Campaign = {
      ...src,
      id: nextCampaignId(),
      name: `${src.name} (copy)`,
      status: "draft",
      sent: 0, delivered: 0, opens: 0, clicks: 0, conversions: 0, revenue: 0,
    };
    set((s) => ({ campaigns: [copy, ...s.campaigns] }));
    return copy;
  },
  removeCampaign: (id) => {
    set((s) => ({ campaigns: s.campaigns.filter((c) => c.id !== id) }));
  },
  toggleAutomation: (id) => {
    set((s) => ({
      automations: s.automations.map((a) =>
        a.id === id ? { ...a, status: a.status === "active" ? "paused" : "active" } : a
      ),
    }));
  },
}));
