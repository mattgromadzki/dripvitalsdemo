import type { Doctor } from "@/lib/types";

// Default prescriber for the practice. Real credentials supplied by the owner.
// ⚠ Items marked PLACEHOLDER must be completed before going live:
//   • FL license EXPIRATION date (the number ME162779 is real; the date below is a placeholder)
//   • Dr. Tancinco's additional state licenses (state, number, expDate)
//   • contact details (email/phone) and bio fields
export const DOCTORS: Doctor[] = [
  {
    id: "DOC-001",
    first: "Emmanuel", last: "Tancinco", middle: "Noel",
    title: "MD", role: "Attending Physician",
    email: "dr.tancinco@dripvitals.health", // PLACEHOLDER — verify/replace
    phone: "",                               // PLACEHOLDER — add real number
    npi: "1639393895",                       // REAL
    dea: "FT0866713",                        // REAL
    boardId: "",
    yearsExperience: 0,                      // PLACEHOLDER
    gender: "",
    specialties: ["Weight Management"],
    active: true, epcs: false, surescripts: true, onCall: true, acceptingNew: true,
    patients: 0,
    color: "var(--color-brand)",
    licenses: [
      // REAL license number; expDate is a PLACEHOLDER — replace with the real FL expiration.
      { state: "FL", number: "ME162779", expDate: "2026-12-31" },
      // ⚠ Dr. Tancinco holds licenses in additional states — add each one here
      //   as { state, number, expDate } (or via Settings → Doctors). Prescribing
      //   is only allowed in states with an active, unexpired license on file.
    ],
  },
];

// Palette used to assign a random avatar color to new doctors/staff.
export const AVATAR_COLOR_POOL: string[] = [
  "var(--color-brand)",
  "var(--color-blue)",
  "var(--color-purple)",
  "var(--color-amber)",
  "var(--color-teal)",
  "var(--color-green)",
  "var(--color-pink)",
  "var(--color-coral)",
];
