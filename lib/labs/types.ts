export type LabStatus = "ordered" | "collected" | "resulted" | "reviewed";
export interface LabResult { analyte: string; unit: string; range: string; value: number; flag: "normal" | "high" | "low"; }
export interface LabOrder {
  id: string; patientId?: string; patientName: string; panelId: string; panelName: string;
  status: LabStatus; orderedAt: string; resultedAt?: string; provider: string;
  results?: LabResult[]; note?: string;
}
