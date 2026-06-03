import type { Campaign, Automation, MessageTemplate, AudienceSegment } from "@/lib/types";

export const CAMPAIGNS: Campaign[] = [
  { id: "CMP-001", name: "GLP-1 Welcome Email",        channel: "email", type: "Triggered",     status: "active",
    audience: "New Enrollments",     sent: 1247, delivered: 1231, opens: 489,  clicks: 148, conversions: 62, revenue: 11618,
    subject: "Welcome to your GLP-1 journey, {first_name}!", icon: "📧", color: "var(--color-blue)", createdDate: "May 1, 2026" },
  { id: "CMP-002", name: "Refill Reminder SMS",         channel: "sms",   type: "Triggered",     status: "active",
    audience: "Refill Due Soon",     sent: 384,  delivered: 379,  opens: 357,  clicks: 89,  conversions: 71, revenue: 13299,
    subject: "",                                             icon: "📱", color: "var(--color-purple)", createdDate: "Apr 28, 2026" },
  { id: "CMP-003", name: "Monthly Progress Check-in",   channel: "email", type: "Recurring",     status: "active",
    audience: "All GLP-1 Patients",  sent: 2841, delivered: 2798, opens: 1119, clicks: 294, conversions: 18, revenue: 3024,
    subject: "How's your progress this month, {first_name}?", icon: "📧", color: "var(--color-brand)", createdDate: "Apr 15, 2026" },
  { id: "CMP-004", name: "Win-Back Inactive Patients",  channel: "email", type: "Triggered",     status: "active",
    audience: "Inactive 60d+",       sent: 156,  delivered: 152,  opens: 54,   clicks: 18,  conversions: 9,  revenue: 1687,
    subject: "We miss you, {first_name} — come back stronger 💪", icon: "📧", color: "var(--color-coral)", createdDate: "Apr 10, 2026" },
  { id: "CMP-005", name: "Order Shipped SMS",           channel: "sms",   type: "Triggered",     status: "active",
    audience: "Active Orders",       sent: 892,  delivered: 889,  opens: 841,  clicks: 0,   conversions: 0,  revenue: 0,
    subject: "",                                             icon: "📱", color: "var(--color-teal)", createdDate: "Apr 5, 2026" },
  { id: "CMP-006", name: "Lab Results Ready",           channel: "both",  type: "Triggered",     status: "active",
    audience: "Pending Lab Review",  sent: 234,  delivered: 230,  opens: 198,  clicks: 87,  conversions: 12, revenue: 2244,
    subject: "Your lab results are in, {first_name}",        icon: "⚡", color: "var(--color-pink)", createdDate: "Mar 28, 2026" },
  { id: "CMP-007", name: "New Lead Nurture Drip",       channel: "email", type: "Drip",          status: "draft",
    audience: "Unqualified Leads",   sent: 0,    delivered: 0,    opens: 0,    clicks: 0,   conversions: 0,  revenue: 0,
    subject: "You're one step away from starting your journey", icon: "📧", color: "var(--color-amber)", createdDate: "May 8, 2026" },
  { id: "CMP-008", name: "Tirzepatide Upgrade Offer",   channel: "both",  type: "One-time Blast",status: "paused",
    audience: "Semaglutide Patients",sent: 486,  delivered: 479,  opens: 187,  clicks: 56,  conversions: 22, revenue: 6556,
    subject: "Upgrade to Tirzepatide — proven better results", icon: "⚡", color: "var(--color-purple)", createdDate: "Mar 14, 2026" },
];

export const AUTOMATIONS: Automation[] = [
  { id: "AUT-001", name: "New Patient Welcome Series", trigger: "Patient enrolled in treatment", steps: 5, channel: "Email + SMS", status: "active", enrolled: 142, completed: 89, icon: "🎉", color: "var(--color-brand)" },
  { id: "AUT-002", name: "Refill Reminder Flow",       trigger: "Refill due in 7 days",          steps: 3, channel: "SMS",         status: "active", enrolled: 42,  completed: 38, icon: "💊", color: "var(--color-purple)" },
  { id: "AUT-003", name: "Post-Delivery Check-in",     trigger: "Order delivered",                steps: 3, channel: "Email",       status: "active", enrolled: 88,  completed: 72, icon: "📦", color: "var(--color-blue)" },
  { id: "AUT-004", name: "Win-back Sequence",          trigger: "Patient goes inactive (30d)",    steps: 4, channel: "Email",       status: "active", enrolled: 28,  completed: 11, icon: "💪", color: "var(--color-coral)" },
  { id: "AUT-005", name: "Lab Results Follow-up",      trigger: "Lab results returned",           steps: 2, channel: "Email + SMS", status: "paused", enrolled: 34,  completed: 22, icon: "🧪", color: "var(--color-teal)" },
];

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  { id: "TPL-001", name: "Welcome Email",     channel: "Email", category: "Welcome",         subject: "Welcome to DripVitals, {first_name}!",     preview: "Hi {first_name}, welcome to your weight loss journey…",      uses: 18, icon: "🎉", color: "var(--color-brand)" },
  { id: "TPL-002", name: "Refill Reminder",   channel: "SMS",   category: "Refill Reminder", subject: "",                                          preview: "Hi {first_name}, your {plan_name} refill is due in 7 days…",  uses: 42, icon: "🔔", color: "var(--color-purple)" },
  { id: "TPL-003", name: "Order Shipped",     channel: "SMS",   category: "Order Update",    subject: "",                                          preview: "DripVitals: Your order is on its way! Track: {tracking_link}", uses: 89, icon: "📦", color: "var(--color-teal)" },
  { id: "TPL-004", name: "Monthly Check-in",  channel: "Email", category: "Engagement",      subject: "How's your progress, {first_name}?",        preview: "It's been a month since you started your {plan_name}…",      uses: 24, icon: "📊", color: "var(--color-blue)" },
  { id: "TPL-005", name: "Lab Results Ready", channel: "Email", category: "Lab Results",     subject: "Your results are in, {first_name}",         preview: "Dr. {doctor_name} has reviewed your recent lab work…",       uses: 12, icon: "🧪", color: "var(--color-pink)" },
  { id: "TPL-006", name: "Win-Back",          channel: "Email", category: "Win-back",        subject: "We miss you, {first_name} 💙",              preview: "It's been a while since your last visit…",                   uses: 8,  icon: "💪", color: "var(--color-coral)" },
];

export const AUDIENCE_SEGMENTS: AudienceSegment[] = [
  { id: "SEG-001", name: "All Active Patients",     description: "Currently enrolled in a treatment plan",         count: 284, icon: "👥", color: "var(--color-brand)",  type: "Dynamic" },
  { id: "SEG-002", name: "Refill Due Soon",          description: "Patients with refill due in next 14 days",        count: 42,  icon: "💊", color: "var(--color-amber)",  type: "Dynamic" },
  { id: "SEG-003", name: "Inactive 60+ days",        description: "No visit, message, or order in 60 days",          count: 18,  icon: "💤", color: "var(--color-coral)",  type: "Dynamic" },
  { id: "SEG-004", name: "Semaglutide Candidates",   description: "Eligible for upgrade to Tirzepatide",             count: 67,  icon: "🎯", color: "var(--color-violet)", type: "Dynamic" },
];
