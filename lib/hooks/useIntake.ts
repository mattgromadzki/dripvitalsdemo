"use client";
import { create } from "@/lib/hooks/zustand-shim";
import type { IntakeSubmission, IntakeStatus } from "@/lib/intake/types";
import { bmiOf } from "@/lib/intake/screening";

const A = (h: number, w: number, g: number, o: Partial<IntakeSubmission["answers"]> = {}) => ({
  heightIn: h, weightLb: w, goalLb: g, bmi: bmiOf(h, w),
  mtcOrMen2: false, pregnantOrNursing: false, pancreatitis: false, gallbladder: false,
  eatingDisorder: false, type2Diabetes: false, kidneyDisease: false, priorGLP1: false,
  currentMeds: "", allergies: "None", ...o,
});

const SEED: IntakeSubmission[] = [
  { id: "IN-5001", patientName: "Hannah Wells", state: "FL", program: "Weight Loss", email: "hannah.w@example.com", phone: "+1 (305) 555-0190", submittedAt: "2026-06-01T12:10:00Z", status: "pending", answers: A(65, 198, 150, { type2Diabetes: true, currentMeds: "Metformin 500mg" }) },
  { id: "IN-5002", patientName: "Derek Olsen", state: "TX", program: "Weight Loss", email: "derek.o@example.com", submittedAt: "2026-06-01T10:30:00Z", status: "pending", answers: A(70, 240, 190, { gallbladder: true, allergies: "Sulfa" }) },
  { id: "IN-5003", patientName: "Rachel Kim", state: "CA", program: "Weight Loss", phone: "+1 (415) 555-0133", submittedAt: "2026-06-01T09:05:00Z", status: "pending", answers: A(64, 150, 135, {}) },
  { id: "IN-5004", patientName: "Tom Bradley", state: "NY", program: "Weight Loss", submittedAt: "2026-05-31T16:00:00Z", status: "pending", answers: A(71, 220, 180, { mtcOrMen2: true }) },
  { id: "IN-5005", patientName: "Olivia Brooks", state: "FL", program: "Weight Loss", submittedAt: "2026-05-30T14:00:00Z", status: "approved", answers: A(66, 205, 160, { priorGLP1: true }), providerNote: "Approved — start 0.25mg.", decidedBy: "Dr. Rivera", decidedAt: "2026-05-30T15:00:00Z" },
];

interface State {
  submissions: IntakeSubmission[];
  decide: (id: string, status: IntakeStatus, note: string) => void;
}
export const useIntake = create<State>((set) => ({
  submissions: SEED,
  decide: (id, status, note) => set((s) => ({
    submissions: s.submissions.map((x) => x.id === id ? { ...x, status, providerNote: note, decidedBy: "Dr. Rivera", decidedAt: new Date().toISOString() } : x),
  })),
}));
