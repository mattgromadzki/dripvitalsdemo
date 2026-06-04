"use client";

import { useNotifications } from "@/lib/hooks/useNotifications";
import type { NotificationLogEntry } from "@/lib/types";

/**
 * Transactional/alert emails to patients. Each helper posts to /api/notify,
 * which renders the (customizable) HTML template for that type and sends it via
 * SendGrid. Results are recorded in the Notifications delivery log, and each
 * alert respects the matching rule's email toggle in the Notifications module.
 */

interface PatientLike { email?: string; first?: string; last?: string; name?: string; }

function nameOf(p: PatientLike) { return p.name || `${p.first ?? ""}`.trim() || "there"; }

function emailEnabled(ruleId?: string): boolean {
  if (!ruleId) return true;
  try { const r = useNotifications.getState().rules.find((x) => x.id === ruleId); return r ? !!r.channels.email : true; }
  catch { return true; }
}

function recordLog(event: string, recipient: string, ok: boolean) {
  try {
    const entry: NotificationLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      time: new Date().toLocaleString(),
      orderedAt: Date.now(),
      event, category: "patient", recipient,
      channels: ["email"], status: ok ? "delivered" : "failed",
    };
    useNotifications.getState().logDelivery(entry);
  } catch { /* ignore */ }
}

async function notify(type: string, to: string, toName: string, data: Record<string, string>): Promise<boolean> {
  try {
    const r = await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, to, toName, data }),
    });
    const d = await r.json();
    return !!d?.ok;
  } catch { return false; }
}

/** Care team sent the patient a chat message. */
export async function alertNewMessageToPatient(patient: PatientLike, preview: string) {
  if (!patient?.email || !emailEnabled()) return;
  const name = nameOf(patient);
  const ok = await notify("new_message", patient.email, name, { name, message: (preview || "").slice(0, 300) || "(view in portal)" });
  recordLog("New care-team message", patient.email, ok);
}

/** An order's status changed (e.g., sent to pharmacy / shipped). */
export async function alertOrderStatusToPatient(patient: PatientLike, order: { id?: string; medication?: string }, status: string) {
  if (!patient?.email || !emailEnabled("n-pat-shipment")) return;
  const name = nameOf(patient);
  const ok = await notify("order_status", patient.email, name, {
    name, orderId: order?.id || "", medication: order?.medication || "", status,
  });
  recordLog(`Order: ${status}`, patient.email, ok);
}
