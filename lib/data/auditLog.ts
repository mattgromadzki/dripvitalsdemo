import type { AuditEvent, AuditCategory } from "@/lib/types";

const ACTIONS: Record<AuditCategory, string[]> = {
  patient:  ["Viewed patient chart", "Downloaded medical record", "Accessed lab results", "Sent secure message", "Edited demographics", "Viewed Rx history", "Exported chart PDF"],
  auth:     ["Login successful", "Password changed", "2FA verified", "Session expired", "Logout", "Token rotated"],
  emr:      ["Created SOAP note", "Signed SOAP note", "Amended SOAP note", "Updated treatment plan", "Ordered lab panel", "Discontinued medication", "Updated allergies"],
  billing:  ["Submitted claim 837P", "Claim adjudicated · paid", "Prior auth requested", "Posted payment", "Refund issued", "Subscription created", "Subscription cancelled"],
  admin:    ["Invited staff member", "Updated permission", "Exported data CSV", "Modified policy rule", "Changed pharmacy partner", "Updated billing config"],
  security: ["Unusual login location", "Failed login attempt", "Token rotated", "New device login", "Suspicious activity flagged", "Password reset requested"],
};

const USERS = [
  { name: "Dr. Sofia Rivera",  color: "var(--color-brand)"   },
  { name: "Dr. James Kim",      color: "var(--color-teal)"    },
  { name: "Dr. Priya Patel",    color: "var(--color-violet)"  },
  { name: "Denise Clark, NP",   color: "var(--color-purple)"  },
  { name: "Nurse Chen",         color: "var(--color-amber)"   },
  { name: "Maria Santos",       color: "var(--color-coral)"   },
  { name: "Alex Park",          color: "var(--color-blue)"    },
  { name: "Marcus Webb",        color: "var(--color-ink-muted)" },
];

const PATIENTS = [
  { name: "Sarah Mitchell",  id: "PT-0041" },
  { name: "Marcus Liu",      id: "PT-0034" },
  { name: "Priya Krishnan",  id: "PT-0031" },
  { name: "Carlos Reyes",    id: "PT-0025" },
  { name: "James Thornton",  id: "PT-0052" },
  { name: "Anna Bellamy",    id: "PT-0027" },
  { name: "Robert Kim",      id: "PT-0018" },
];

// Seeded PRNG for deterministic output
function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const CATS: AuditCategory[] = ["patient", "auth", "emr", "billing", "admin", "security"];

export const AUDIT_EVENTS: AuditEvent[] = (() => {
  const rng = seededRand(2024);
  const events: AuditEvent[] = [];

  // Generate 250 events spanning the last ~7 days
  for (let i = 0; i < 250; i++) {
    const cat = CATS[i % CATS.length];
    const action = ACTIONS[cat][i % ACTIONS[cat].length];
    const user = USERS[i % USERS.length];

    // Time decay — newer events at the top (i=0 is now), oldest at the bottom
    const minutesAgo = Math.floor(i * 2.8 + rng() * 4);
    const totalMinutesInDay = 24 * 60;
    const daysAgo = Math.floor(minutesAgo / totalMinutesInDay);
    const minutesIntoDay = minutesAgo % totalMinutesInDay;
    const hour = 23 - Math.floor(minutesIntoDay / 60);
    const minute = 59 - (minutesIntoDay % 60);

    let timeLabel: string;
    if (daysAgo === 0) {
      const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const ampm = hour >= 12 ? "PM" : "AM";
      timeLabel = `Today ${String(h12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${ampm}`;
    } else if (daysAgo === 1) {
      const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const ampm = hour >= 12 ? "PM" : "AM";
      timeLabel = `Yesterday ${String(h12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${ampm}`;
    } else {
      const dayOfMonth = 29 - daysAgo;
      const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const ampm = hour >= 12 ? "PM" : "AM";
      timeLabel = `May ${dayOfMonth} ${String(h12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${ampm}`;
    }

    // Use day-relative sortable ts (higher = newer)
    const orderedAt = 99999999 - i;

    const hasPatient = (cat === "patient" || cat === "emr") && rng() > 0.15;
    const patient = hasPatient ? PATIENTS[i % PATIENTS.length] : undefined;

    const success = !(cat === "security" && action.startsWith("Failed")) && rng() > 0.04;

    events.push({
      id: `EVT-${String(900000 - i).padStart(6, "0")}`,
      timestamp: timeLabel,
      orderedAt,
      user: user.name,
      userColor: user.color,
      category: cat,
      action,
      resourceType: cat === "patient" ? "Patient" : cat === "emr" ? "Chart" : cat === "billing" ? "Claim" : undefined,
      patientName: patient?.name,
      patientId: patient?.id,
      ipAddress: `192.168.1.${100 + (i % 50)}`,
      userAgent: i % 3 === 0 ? "Chrome 128 · macOS" : i % 3 === 1 ? "Safari 17 · iOS" : "Edge 128 · Windows",
      success,
      errorMessage: !success ? "Access denied by policy or auth failure" : undefined,
    });
  }
  return events;
})();
