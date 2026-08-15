"use client";
import { create } from "@/lib/hooks/zustand-shim";
import { seedList } from "@/lib/config/runtime";
import type { FarmContact, FarmGroup, FarmCampaign, FarmStatus, CampaignStatus } from "@/lib/types/farming";
import { FARM_CONTACTS_SEED, FARM_GROUPS_SEED, FARM_CAMPAIGNS_SEED } from "@/lib/data/farming";

// Monotonic id allocators (see useShop's note — beats max()+1 after deletes).
let contactSeq = 2000;
let groupSeq = 200;
let campaignSeq = 600;
const nextContactId = () => "FC-" + ++contactSeq;
const nextGroupId = () => "FG-" + ++groupSeq;
const nextCampaignId = () => "FCMP-" + ++campaignSeq;

export type ContactInput = Omit<FarmContact, "id" | "createdAt" | "optedOut" | "groupIds" | "status"> &
  Partial<Pick<FarmContact, "groupIds" | "status" | "optedOut">>;

interface State {
  contacts: FarmContact[];
  groups: FarmGroup[];
  campaigns: FarmCampaign[];

  // contacts
  addContact: (c: ContactInput) => FarmContact;
  addContacts: (items: ContactInput[]) => number;
  updateContact: (id: string, patch: Partial<FarmContact>) => void;
  removeContacts: (ids: string[]) => void;
  setStatusMany: (ids: string[], status: FarmStatus) => void;
  addToGroupMany: (ids: string[], groupId: string) => void;
  moveToGroupMany: (ids: string[], groupId: string) => void; // replace membership
  removeFromGroupMany: (ids: string[], groupId: string) => void;
  setOptedOut: (id: string, optedOut: boolean) => void;

  // groups
  addGroup: (g: Omit<FarmGroup, "id">) => FarmGroup;
  updateGroup: (id: string, patch: Partial<FarmGroup>) => void;
  removeGroup: (id: string) => void; // also strips the id from every contact

  // campaigns
  addCampaign: (c: Omit<FarmCampaign, "id" | "createdAt" | "totalRecipients" | "sent" | "delivered" | "failed">) => FarmCampaign;
  updateCampaign: (id: string, patch: Partial<FarmCampaign>) => void;
  duplicateCampaign: (id: string) => FarmCampaign | null;
  setCampaignStatus: (id: string, status: CampaignStatus) => void;
  removeCampaign: (id: string) => void;
}

export const useFarming = create<State>((set) => ({
  contacts: seedList(FARM_CONTACTS_SEED),
  groups: seedList(FARM_GROUPS_SEED),
  campaigns: seedList(FARM_CAMPAIGNS_SEED),

  addContact: (input) => {
    const created: FarmContact = {
      groupIds: [], status: "new", optedOut: false,
      ...input,
      id: nextContactId(), createdAt: new Date().toISOString(),
    };
    set((s) => ({ contacts: [created, ...s.contacts] }));
    return created;
  },
  addContacts: (items) => {
    const made = items.map((input) => ({
      groupIds: [] as string[], status: "new" as FarmStatus, optedOut: false,
      ...input,
      id: nextContactId(), createdAt: new Date().toISOString(),
    }));
    set((s) => ({ contacts: [...made, ...s.contacts] }));
    return made.length;
  },
  updateContact: (id, patch) => set((s) => ({
    contacts: s.contacts.map((c) => (c.id === id ? { ...c, ...patch } : c)),
  })),
  removeContacts: (ids) => { const kill = new Set(ids); set((s) => ({ contacts: s.contacts.filter((c) => !kill.has(c.id)) })); },
  setStatusMany: (ids, status) => { const hit = new Set(ids); set((s) => ({ contacts: s.contacts.map((c) => (hit.has(c.id) ? { ...c, status } : c)) })); },
  addToGroupMany: (ids, groupId) => { const hit = new Set(ids); set((s) => ({ contacts: s.contacts.map((c) => (hit.has(c.id) && !c.groupIds.includes(groupId) ? { ...c, groupIds: [...c.groupIds, groupId] } : c)) })); },
  moveToGroupMany: (ids, groupId) => { const hit = new Set(ids); set((s) => ({ contacts: s.contacts.map((c) => (hit.has(c.id) ? { ...c, groupIds: [groupId] } : c)) })); },
  removeFromGroupMany: (ids, groupId) => { const hit = new Set(ids); set((s) => ({ contacts: s.contacts.map((c) => (hit.has(c.id) ? { ...c, groupIds: c.groupIds.filter((g) => g !== groupId) } : c)) })); },
  setOptedOut: (id, optedOut) => set((s) => ({
    contacts: s.contacts.map((c) => (c.id === id ? { ...c, optedOut, status: optedOut ? "unsubscribed" : c.status, optOutAt: optedOut ? new Date().toISOString() : undefined, optOutChannel: optedOut ? "both" : undefined } : c)),
  })),

  addGroup: (input) => {
    const created: FarmGroup = { ...input, id: nextGroupId() };
    set((s) => ({ groups: [...s.groups, created] }));
    return created;
  },
  updateGroup: (id, patch) => set((s) => ({ groups: s.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
  removeGroup: (id) => set((s) => ({
    groups: s.groups.filter((g) => g.id !== id),
    contacts: s.contacts.map((c) => (c.groupIds.includes(id) ? { ...c, groupIds: c.groupIds.filter((g) => g !== id) } : c)),
  })),

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
      totalRecipients: 0, sent: 0, delivered: 0, failed: 0, cursor: undefined,
      recipientSnapshot: undefined, results: undefined,
    };
    set((s) => ({ campaigns: [copy, ...s.campaigns] }));
    return copy;
  },
  setCampaignStatus: (id, status) => set((s) => ({ campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, status } : c)) })),
  removeCampaign: (id) => set((s) => ({ campaigns: s.campaigns.filter((c) => c.id !== id) })),
}));
