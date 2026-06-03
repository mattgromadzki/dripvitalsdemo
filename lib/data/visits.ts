import type { QueueVisit } from "@/lib/types";

// Visits for today's queue. patientId is set when the patient is in our roster
// (so we can deep-link to their chart). David Nguyen and Emma Wilson don't have
// chart records — they're walk-in / external referrals for demo purposes.
export const QUEUE_VISITS: QueueVisit[] = [
  { id: "V-001", patientName: "Sarah Mitchell",   patientId: "PT-0041", time: "9:00 AM",  type: "GLP-1 Check-in",          provider: "Dr. Rivera", reason: "Weight check + BP review",            status: "completed",   color: "var(--color-brand)"  },
  { id: "V-002", patientName: "Marcus Liu",       patientId: "PT-0034", time: "9:30 AM",  type: "Medication Review",       provider: "Dr. Patel",  reason: "Tirzepatide escalation eval",          status: "completed",   color: "var(--color-teal)"   },
  { id: "V-003", patientName: "Priya Krishnan",   patientId: "PT-0031", time: "10:00 AM", type: "Side Effect Review",      provider: "Dr. Rivera", reason: "Nausea management",                    status: "completed",   color: "var(--color-purple)" },
  { id: "V-004", patientName: "Carlos Reyes",     patientId: "PT-0025", time: "10:30 AM", type: "GLP-1 Check-in",          provider: "Dr. Patel",  reason: "Monthly progress review",              status: "in_progress", color: "var(--color-brand)"  },
  { id: "V-005", patientName: "James Thornton",   patientId: "PT-0052", time: "11:00 AM", type: "Labs Review",             provider: "Dr. Rivera", reason: "HbA1c and metabolic panel",            status: "in_progress", color: "var(--color-amber)"  },
  { id: "V-006", patientName: "Anna Bellamy",     patientId: "PT-0027", time: "11:30 AM", type: "Initial Consultation",    provider: "Dr. Patel",  reason: "New patient — weight eval",            status: "in_progress", color: "var(--color-pink)"   },
  { id: "V-007", patientName: "David Nguyen",                            time: "2:00 PM",  type: "GLP-1 Check-in",          provider: "Dr. Rivera", reason: "Week 24 maintenance",                   status: "waiting",     color: "var(--color-blue)"   },
  { id: "V-008", patientName: "Emma Wilson",                             time: "2:30 PM",  type: "Urgent — Side Effect",    provider: "Dr. Patel",  reason: "Severe nausea reported",                status: "urgent",      color: "var(--color-red)"    },
];
