"use client";
import { create } from "@/lib/hooks/zustand-shim";
import { seedList } from "@/lib/config/runtime";
import type { FarmGroup, FarmCampaign, CampaignStatus } from "@/lib/types/farming";
import { FARM_GROUPS_SEED, FARM_CAMPAIGNS_SEED } from "@/lib/data/farming";

// Groups + campaign definitions are small and stay client-mirrored (serverPersist
// blobs). CONTACTS are NOT here — they live in the paginated Postgres table
// (lib/farming/contactsDb) and are fetched by page via lib/farming/contactsClient.

let groupSeq = 200;
let campaignSeq = 600;
const nextGroupId = () => "FG-" + ++groupSeq;
const nextCampaignId = () => "FCMP-" + ++campaignSeq;

interface State {
  groups: FarmGroup[];
  campaigns: FarmCampaign[];

  addGroup: (g: Omit<FarmGroup, "id">) => FarmGroup;
  updateGroup: (id: string, patch: Partial<FarmGroup>) => void;
  removeGroup: (id: string) => void;

  addCampaign: (c: Omit<FarmCampaign, "id" | "createdAt" | "totalRecipients" | "sent" | "delivered" | "failed">) => FarmCampaign;
  updateCampaign: (id: string, patch: Partial<FarmCampaign>) => void;
  duplicateCampaign: (id: string) => FarmCampaign | null;
  setCampaignStatus: (id: string, status: CampaignStatus) => void;
  removeCampaign: (id: string) => void;
}

export const useFarming = create<State>((set) => ({
  groups: seedList(FARM_GROUPS_SEED),
  campaigns: seedList(FARM_CAMPAIGNS_SEED),

  addGroup: (input) => {
    const created: FarmGroup = { ...input, id: nextGroupId() };
    set((s) => ({ groups: [...s.groups, created] }));
    return created;
  },
  updateGroup: (id, patch) => set((s) => ({ groups: s.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
  // Contact rows are stripped of the group server-side (contactsDb.stripGroup),
  // not here — the store no longer holds contacts.
  removeGroup: (id) => set((s) => ({ groups: s.groups.filter((g) => g.id !== id) })),

  addCampaign: (input) => {
    const created: FarmCampaign = {
      ...input,
      id: nextCampaignId(), createdAt: new Date().toISOString(),
      totalRecipients: 0, sent: 0, delivered: 0, failed: 0,
    };
    set((s) => ({ campaigns: [created, ...s.campaigns] }));
    return created;
  },
  updateCampaign: (id, patch) => set((s) => ({ campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
  duplicateCampaign: (id) => {
    const src = useFarming.getState().campaigns.find((c) => c.id === id);
    if (!src) return null;
    const copy: FarmCampaign = {
      ...src, id: nextCampaignId(), name: `${src.name} (copy)`, status: "draft",
      scheduledAt: undefined, startedAt: undefined, completedAt: undefined,
      createdAt: new Date().toISOString(),
      totalRecipients: 0, sent: 0, delivered: 0, failed: 0, cursor: null,
    };
    set((s) => ({ campaigns: [copy, ...s.campaigns] }));
    return copy;
  },
  setCampaignStatus: (id, status) => set((s) => ({ campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, status } : c)) })),
  removeCampaign: (id) => set((s) => ({ campaigns: s.campaigns.filter((c) => c.id !== id) })),
}));
