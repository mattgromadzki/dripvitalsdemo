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
      // Dr. Tancinco's active state medical licenses. Prescribing is only allowed
      // in states with an unexpired license on file. expDate is ISO (YYYY-MM-DD).
      { state: "AL", number: "51184", expDate: "2026-12-31" },
      { state: "AR", number: "E-5612", expDate: "2027-12-31" },
      { state: "AZ", number: "78978", expDate: "2026-12-25" },
      { state: "CA", number: "C198642", expDate: "2026-10-31" },
      { state: "CO", number: "CDR.0006099", expDate: "2027-04-30" },
      { state: "DE", number: "C1-0028851", expDate: "2027-03-31" },
      { state: "FL", number: "ME162779", expDate: "2027-01-31" },
      { state: "GA", number: "110205", expDate: "2027-12-31" },
      { state: "IA", number: "MD-56123", expDate: "2027-12-01" },
      { state: "IL", number: "036.173955", expDate: "2026-07-31" },
      { state: "IN", number: "01098398A", expDate: "2027-10-31" },
      { state: "LA", number: "345610", expDate: "2026-12-31" },
      { state: "MD", number: "D0105291", expDate: "2027-09-30" },
      { state: "ME", number: "MD30026", expDate: "2027-12-31" },
      { state: "MN", number: "81240", expDate: "2026-12-31" },
      { state: "MO", number: "2009026152", expDate: "2027-01-31" },
      { state: "NJ", number: "25IA12917900", expDate: "2027-06-30" },
      { state: "NV", number: "28468", expDate: "2027-06-30" },
      { state: "NY", number: "329984-01", expDate: "2027-11-30" },
      { state: "OH", number: "35C.003513", expDate: "2027-12-09" },
      { state: "OK", number: "46996", expDate: "2026-11-01" },
      { state: "PA", number: "MD493013C", expDate: "2026-12-31" },
      { state: "TN", number: "73879", expDate: "2027-12-31" },
      { state: "TX", number: "U9092", expDate: "2028-02-28" },
      { state: "UT", number: "14257334-1235", expDate: "2028-01-31" },
      { state: "WI", number: "14538-320", expDate: "2027-10-31" },
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
