"use client";

import { useNotifications } from "@/lib/hooks/useNotifications";
import type { NotificationLogEntry } from "@/lib/types";

/**
 * Lifecycle/alert emails. Each helper posts to /api/notify, which renders the
 * (customizable) template for that type and sends it via SendGrid. Results are
 * recorded in the Notifications delivery log; shipping-type alerts respect the
 * "n-pat-shipment" rule's email toggle.
 */
interface PatientLike { email?: string; first?: string; last?: string; name?: string; brandId?: string; }
function nameOf(p: PatientLike) { return p.name || `${p.first ?? ""}`.trim() || "there"; }

function emailEnabled(ruleId?: string): boolean {
  if (!ruleId) return true;
  try { const r = useNotifications.getState().rules.find((x) => x.id === ruleId); return r ? !!r.channels.email : true; }
  catch { return true; }
}
function recordLog(event: string, recipient: string, ok: boolean) {
  try {
    useNotifications.getState().logDelivery({
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      time: new Date().toLocaleString(), orderedAt: Date.now(),
      event, category: "patient", recipient, channels: ["email"],
      status: ok ? "delivered" : "failed",
    } as NotificationLogEntry);
  } catch { /* ignore */ }
}
async function notify(type: string, to: string, toName: string, data: Record<string, string>, brandId?: string): Promise<boolean> {
  try {
    const r = await fetch("/api/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, to, toName, data, brandId }) });
    const d = await r.json();
    return !!d?.ok;
  } catch { return false; }
}

/** Account created → welcome. */
export async function alertWelcome(patient: PatientLike) {
  if (!patient?.email) return;
  const name = nameOf(patient);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const setPasswordUrl = `${origin}/patient-portal?setpw=${encodeURIComponent(patient.email)}`;
  const ok = await notify("welcome", patient.email, name, { name, setPasswordUrl }, patient.brandId);
  recordLog("Welcome email", patient.email, ok);
}

/** Provider approved the treatment → congratulations. */
export async function alertApproval(patient: PatientLike, treatmentName?: string) {
  if (!patient?.email) return;
  const name = nameOf(patient);
  const ok = await notify("approval", patient.email, name, { name, treatment: treatmentName ? ` (${treatmentName})` : "" }, patient.brandId);
  recordLog("Approval / congratulations", patient.email, ok);
}

/** Prescription approved & sent to pharmacy. */
export async function alertRxPharmacy(patient: PatientLike, info: { medication?: string; pharmacy?: string }) {
  if (!patient?.email || !emailEnabled("n-pat-shipment")) return;
  const name = nameOf(patient);
  const ok = await notify("rx_pharmacy", patient.email, name, {
    name, medication: info.medication ? ` (${info.medication})` : "", pharmacy: info.pharmacy || "the pharmacy",
  }, patient.brandId);
  recordLog("Prescription sent to pharmacy", patient.email, ok);
}

/** Order is being prepared / status advanced. */
export async function alertOrderProcessing(patient: PatientLike, info: { orderId?: string; status?: string }) {
  if (!patient?.email || !emailEnabled("n-pat-shipment")) return;
  const name = nameOf(patient);
  const ok = await notify("order_processing", patient.email, name, { name, orderId: info.orderId || "", status: info.status || "Being prepared" }, patient.brandId);
  recordLog(`Order processing: ${info.status || "being prepared"}`, patient.email, ok);
}

/** Order shipped — tracking number + delivery estimate. */
export async function alertShipment(patient: PatientLike, info: { carrier?: string; tracking?: string; eta?: string; orderId?: string }) {
  if (!patient?.email || !emailEnabled("n-pat-shipment")) return;
  const name = nameOf(patient);
  const ok = await notify("shipment", patient.email, name, {
    name, carrier: info.carrier || "the carrier", tracking: info.tracking || "(see portal)", eta: info.eta || "soon", orderId: info.orderId || "",
  }, patient.brandId);
  recordLog("Shipment notification", patient.email, ok);
}

/** Order delivered — confirmation + storage instructions. */
export async function alertDelivered(patient: PatientLike, info: { orderId?: string }) {
  if (!patient?.email || !emailEnabled("n-pat-shipment")) return;
  const name = nameOf(patient);
  const ok = await notify("delivered", patient.email, name, { name, orderId: info.orderId || "" }, patient.brandId);
  recordLog("Delivered confirmation", patient.email, ok);
}

/** Subscription charge failed. */
export async function alertPaymentFailed(patient: PatientLike, info: { amount?: string; plan?: string }) {
  if (!patient?.email) return;
  const name = nameOf(patient);
  const ok = await notify("payment_failed", patient.email, name, { name, amount: info.amount || "your subscription", plan: info.plan || "subscription" }, patient.brandId);
  recordLog("Failed payment alert", patient.email, ok);
}

/** Care team sent the patient a chat message. */
export async function alertNewMessageToPatient(patient: PatientLike, preview: string) {
  if (!patient?.email || !emailEnabled()) return;
  const name = nameOf(patient);
  const ok = await notify("new_message", patient.email, name, { name, message: (preview || "").slice(0, 300) || "(view in portal)" }, patient.brandId);
  recordLog("New care-team message", patient.email, ok);
}
