import type { NotificationRule, NotificationLogEntry, NotificationQuietHours } from "@/lib/types";

export const NOTIFICATION_RULES: NotificationRule[] = [
  // ── Clinical Alerts ────────────────────────────────────────────────────
  {
    id: "n-clin-critical-lab",
    category: "clinical",
    icon: "🧪",
    title: "Critical lab value",
    description: "Results outside critical range require immediate provider acknowledgment",
    channels: { email: true, sms: true, push: true, in_app: true },
  },
  {
    id: "n-clin-abnormal-vitals",
    category: "clinical",
    icon: "📊",
    title: "Abnormal vitals",
    description: "Patient vitals outside normal threshold (BP > 160/100, HR > 110, etc.)",
    channels: { email: true, sms: false, push: true, in_app: true },
  },
  {
    id: "n-clin-missed-appt",
    category: "clinical",
    icon: "📅",
    title: "Appointment missed",
    description: "Patient did not join scheduled visit within 5 minutes of start",
    channels: { email: true, sms: true, push: false, in_app: true },
  },
  {
    id: "n-clin-pa-denied",
    category: "clinical",
    icon: "💊",
    title: "Prior auth denied",
    description: "Insurance denied PA request — patient cannot receive medication",
    channels: { email: true, sms: true, push: false, in_app: true },
  },
  {
    id: "n-clin-drug-interaction",
    category: "clinical",
    icon: "⚠",
    title: "Drug interaction detected",
    description: "Real-time DDI check flags potential interaction at prescribing",
    channels: { email: false, sms: false, push: true, in_app: true },
  },

  // ── Patient Communications ─────────────────────────────────────────────
  {
    id: "n-pat-appt-confirm",
    category: "patient",
    icon: "📅",
    title: "Appointment confirmation",
    description: "Sent automatically when visit is booked",
    channels: { email: true, sms: true, push: false, in_app: false },
  },
  {
    id: "n-pat-reminder-24h",
    category: "patient",
    icon: "⏰",
    title: "Reminder: 24h before",
    description: "Day-before reminder with join link",
    channels: { email: true, sms: true, push: false, in_app: false },
  },
  {
    id: "n-pat-injection-reminder",
    category: "patient",
    icon: "💉",
    title: "Weekly injection reminder",
    description: "Reminder for scheduled weekly GLP-1 injection",
    channels: { email: false, sms: true, push: true, in_app: false },
  },
  {
    id: "n-pat-shipment",
    category: "patient",
    icon: "📦",
    title: "Shipment notification",
    description: "Tracking info sent when medication ships from pharmacy",
    channels: { email: true, sms: true, push: false, in_app: false },
  },
  {
    id: "n-pat-payment",
    category: "patient",
    icon: "💳",
    title: "Payment receipt",
    description: "Receipt sent after successful subscription charge",
    channels: { email: true, sms: false, push: false, in_app: false },
  },
  {
    id: "n-pat-lab-ready",
    category: "patient",
    icon: "🧪",
    title: "Lab results ready",
    description: "Sent when results are reviewed and released to portal",
    channels: { email: true, sms: false, push: false, in_app: false },
  },

  // ── Staff Alerts ───────────────────────────────────────────────────────
  {
    id: "n-staff-task-assigned",
    category: "staff",
    icon: "📋",
    title: "New task assigned",
    description: "Alert when a task is assigned to you",
    channels: { email: true, sms: false, push: true, in_app: true },
  },
  {
    id: "n-staff-new-message",
    category: "staff",
    icon: "💬",
    title: "New patient message",
    description: "Unread message in your secure inbox",
    channels: { email: false, sms: false, push: true, in_app: true },
  },
  {
    id: "n-staff-referral",
    category: "staff",
    icon: "📥",
    title: "New referral received",
    description: "Incoming referral from external provider",
    channels: { email: true, sms: true, push: false, in_app: true },
  },
  {
    id: "n-staff-weekly-report",
    category: "staff",
    icon: "📊",
    title: "Weekly report ready",
    description: "Analytics summary every Monday morning",
    channels: { email: true, sms: false, push: false, in_app: false },
  },
  {
    id: "n-staff-login-new-device",
    category: "staff",
    icon: "🔐",
    title: "Login from new device",
    description: "Security alert when your account is accessed from a new device",
    channels: { email: true, sms: true, push: false, in_app: true },
  },
];

export const NOTIFICATION_LOG: NotificationLogEntry[] = [
  { id: "log-001", time: "10:32 AM",          orderedAt: 20260529_1032, event: "Appointment reminder",  category: "patient",  recipient: "Sarah Mitchell",  channels: ["sms"],            status: "delivered" },
  { id: "log-002", time: "10:28 AM",          orderedAt: 20260529_1028, event: "Critical lab value",    category: "clinical", recipient: "Dr. Rivera",       channels: ["email", "sms"],    status: "delivered" },
  { id: "log-003", time: "9:55 AM",           orderedAt: 20260529_0955, event: "New task assigned",     category: "staff",    recipient: "Nurse Chen",       channels: ["push"],            status: "delivered" },
  { id: "log-004", time: "9:41 AM",           orderedAt: 20260529_0941, event: "Shipment notification", category: "patient",  recipient: "Marcus Liu",       channels: ["email"],           status: "delivered" },
  { id: "log-005", time: "9:12 AM",           orderedAt: 20260529_0912, event: "Login from new device", category: "staff",    recipient: "Dr. Kim",          channels: ["email", "sms"],    status: "delivered" },
  { id: "log-006", time: "8:50 AM",           orderedAt: 20260529_0850, event: "Payment failed",        category: "system",   recipient: "Carlos Reyes",     channels: ["email", "sms"],    status: "delivered" },
  { id: "log-007", time: "Yesterday 6:00 PM", orderedAt: 20260528_1800, event: "Weekly analytics report", category: "staff",  recipient: "Dr. Rivera",       channels: ["email"],           status: "delivered" },
  { id: "log-008", time: "Yesterday 3:14 PM", orderedAt: 20260528_1514, event: "PA denial alert",       category: "clinical", recipient: "Nurse Chen",       channels: ["email"],           status: "failed", errorMessage: "Mailbox unreachable — retrying in 1h" },
  { id: "log-009", time: "Yesterday 2:08 PM", orderedAt: 20260528_1408, event: "Lab results ready",     category: "patient",  recipient: "Priya Krishnan",   channels: ["email"],           status: "delivered" },
  { id: "log-010", time: "Yesterday 11:45 AM",orderedAt: 20260528_1145, event: "Injection reminder",    category: "patient",  recipient: "Robert Kim",       channels: ["sms", "push"],     status: "delivered" },
  { id: "log-011", time: "May 27, 4:22 PM",   orderedAt: 20260527_1622, event: "Appointment confirmation", category: "patient", recipient: "Anna Bellamy",   channels: ["email", "sms"],    status: "delivered" },
  { id: "log-012", time: "May 27, 9:00 AM",   orderedAt: 20260527_0900, event: "New patient message",   category: "staff",    recipient: "Dr. Rivera",       channels: ["push", "in_app"],  status: "delivered" },
];

export const DEFAULT_QUIET_HOURS: NotificationQuietHours = {
  enabled: true,
  startHour: 21,     // 9 PM
  endHour: 7,        // 7 AM
  exceptUrgent: true,
};
