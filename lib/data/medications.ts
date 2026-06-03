import type { Medication } from "@/lib/types";

export type MedProgramIntent = "blue" | "coral" | "purple" | "teal" | "pink" | "muted";

export const MED_PROGRAM_INTENT: Record<string, MedProgramIntent> = {
  "Weight Loss": "blue", "TRT": "coral", "ED": "purple", "NAD+": "teal", "Sermorelin": "pink", "Vitamins": "muted",
};
export const MED_PROGRAMS = ["Weight Loss", "TRT", "ED", "NAD+", "Sermorelin", "Vitamins"];
export const MED_PHARMACIES = ["RXCompound Store", "DripVitals Compounding", "Empower", "Tailor Made", "Hallandale Rx", "Belmar Pharmacy"];
export const MED_FORMS = ["Vial", "10 mL vial", "5 mL vial", "Tablet", "Syringe", "Nasal Spray", "Foam", "Cream", "Drops"];

export const MEDICATIONS_SEED: Medication[] = [
  { id: "MED-001", name: "Compounded Semaglutide", strength: "0.25 mg", program: "Weight Loss", form: "Vial", pharmacy: "DripVitals Compounding", unit: "per vial", cost: 89, ship: 14, sent: 420, status: "active" },
  { id: "MED-002", name: "Compounded Semaglutide", strength: "0.5 mg", program: "Weight Loss", form: "Vial", pharmacy: "DripVitals Compounding", unit: "per vial", cost: 95, ship: 14, sent: 612, status: "active" },
  { id: "MED-003", name: "Compounded Semaglutide", strength: "1.0 mg", program: "Weight Loss", form: "Vial", pharmacy: "Empower", unit: "per vial", cost: 110, ship: 16, sent: 284, status: "active" },
  { id: "MED-004", name: "Tirzepatide", strength: "2.5 mg", program: "Weight Loss", form: "Vial", pharmacy: "Empower", unit: "per vial", cost: 145, ship: 16, sent: 356, status: "active" },
  { id: "MED-005", name: "Tirzepatide", strength: "5 mg", program: "Weight Loss", form: "Vial", pharmacy: "Tailor Made", unit: "per vial", cost: 168, ship: 15, sent: 198, status: "active" },
  { id: "MED-006", name: "Tirzepatide", strength: "7.5 mg", program: "Weight Loss", form: "Vial", pharmacy: "Tailor Made", unit: "per vial", cost: 189, ship: 15, sent: 92, status: "active" },
  { id: "MED-007", name: "Testosterone Cypionate", strength: "200 mg/mL", program: "TRT", form: "10 mL vial", pharmacy: "Empower", unit: "per vial", cost: 62, ship: 12, sent: 174, status: "active" },
  { id: "MED-008", name: "Sildenafil", strength: "100 mg", program: "ED", form: "Tablet", pharmacy: "Hallandale Rx", unit: "per 10 tabs", cost: 18, ship: 8, sent: 240, status: "active" },
  { id: "MED-009", name: "Tadalafil", strength: "20 mg", program: "ED", form: "Tablet", pharmacy: "Hallandale Rx", unit: "per 10 tabs", cost: 22, ship: 8, sent: 156, status: "active" },
  { id: "MED-010", name: "NAD+ Injection", strength: "100 mg/mL", program: "NAD+", form: "5 mL vial", pharmacy: "DripVitals Compounding", unit: "per vial", cost: 130, ship: 14, sent: 64, status: "active" },
  { id: "MED-011", name: "Sermorelin", strength: "0.3 mg", program: "Sermorelin", form: "Vial", pharmacy: "Belmar Pharmacy", unit: "per vial", cost: 78, ship: 13, sent: 88, status: "active" },
  { id: "MED-012", name: "Vitamin B12", strength: "1 mg/mL", program: "Vitamins", form: "Syringe", pharmacy: "DripVitals Compounding", unit: "per syringe", cost: 8, ship: 6, sent: 310, status: "discontinued" },
];
