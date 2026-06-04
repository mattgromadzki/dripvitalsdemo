"use client";

import { create } from "@/lib/hooks/zustand-shim";
import type { NotificationRule, NotificationLogEntry, NotificationQuietHours, NotificationChannel } from "@/lib/types";
import { NOTIFICATION_RULES as RULE_SEED, NOTIFICATION_LOG as LOG_SEED, DEFAULT_QUIET_HOURS } from "@/lib/data/notifications";

interface NotificationsState {
  rules: NotificationRule[];
  log: NotificationLogEntry[];
  quietHours: NotificationQuietHours;
  toggleChannel: (ruleId: string, channel: NotificationChannel) => void;
  toggleAllForRule: (ruleId: string, enabled: boolean) => void;
  setQuietHours: (patch: Partial<NotificationQuietHours>) => void;
  retryDelivery: (logId: string) => void;
  logDelivery: (entry: NotificationLogEntry) => void;
}

export const useNotifications = create<NotificationsState>((set) => ({
  rules: RULE_SEED,
  log: LOG_SEED,
  quietHours: DEFAULT_QUIET_HOURS,
  toggleChannel: (ruleId, channel) => {
    set((s) => ({
      rules: s.rules.map((r) => {
        if (r.id !== ruleId) return r;
        return { ...r, channels: { ...r.channels, [channel]: !r.channels[channel] } };
      }),
    }));
  },
  toggleAllForRule: (ruleId, enabled) => {
    set((s) => ({
      rules: s.rules.map((r) =>
        r.id === ruleId
          ? { ...r, channels: { email: enabled, sms: enabled, push: enabled, in_app: enabled } }
          : r
      ),
    }));
  },
  setQuietHours: (patch) => {
    set((s) => ({ quietHours: { ...s.quietHours, ...patch } }));
  },
  retryDelivery: (logId) => {
    set((s) => ({
      log: s.log.map((l) => (l.id === logId ? { ...l, status: "delivered" as const, errorMessage: undefined } : l)),
    }));
  },
  logDelivery: (entry) => set((s) => ({ log: [entry, ...s.log] })),
}));
