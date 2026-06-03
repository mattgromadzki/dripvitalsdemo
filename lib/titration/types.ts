export type TitrationStatus = "titrating" | "maintenance" | "hold";
export interface PatientTitration {
  id: string; patientId?: string; patientName: string;
  protocolId: string; med: string; stepIndex: number;
  startedAt: string; currentStepStart: string; status: TitrationStatus;
}
