import type { Severity } from "./symptoms";
export type ReportStatus = "open" | "reviewing" | "resolved";
export interface SideEffectReport {
  id: string; patientId?: string; patientName: string; med: string;
  symptom: string; severity: Severity; onset: string; note: string;
  status: ReportStatus; escalated: boolean; reportedAt: string;
  providerNote?: string; decidedBy?: string; decidedAt?: string;
}
