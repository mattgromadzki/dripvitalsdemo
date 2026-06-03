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
