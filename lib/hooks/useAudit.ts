"use client";

import { create } from "@/lib/hooks/zustand-shim";
import type { AuditEvent } from "@/lib/types";
import { AUDIT_EVENTS as SEED } from "@/lib/data/auditLog";
import { seedList } from "@/lib/config/runtime";

interface AuditState {
  events: AuditEvent[];
  // Append-only — events cannot be modified or deleted per HIPAA §164.312(b)
  append: (event: Omit<AuditEvent, "id">) => AuditEvent;
}

let seq = 900250;

export const useAudit = create<AuditState>((set) => ({
  events: seedList(SEED),
  append: (input) => {
    const created: AuditEvent = { id: `EVT-${seq++}`, ...input };
    set((s) => ({ events: [created, ...s.events] }));
    return created;
  },
}));
