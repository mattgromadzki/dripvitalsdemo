"use client";

import { Pill } from "@/components/ui/Pill";
import { WORKFLOW_META, type WorkflowStatus } from "@/lib/data/orderWorkflow";

export function StatusBadge({ status }: { status: WorkflowStatus }) {
  const m = WORKFLOW_META[status];
  return <Pill intent={m.intent} dot>{m.label}</Pill>;
}
