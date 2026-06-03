export type IntakeStatus = "pending" | "approved" | "denied" | "info";
export interface IntakeAnswers {
  heightIn: number; weightLb: number; goalLb: number; bmi: number;
  mtcOrMen2: boolean; pregnantOrNursing: boolean; pancreatitis: boolean;
  gallbladder: boolean; eatingDisorder: boolean; type2Diabetes: boolean; kidneyDisease: boolean;
  priorGLP1: boolean; currentMeds: string; allergies: string;
}
export interface IntakeSubmission {
  id: string; patientName: string; state: string; program: string;
  email?: string; phone?: string; submittedAt: string; status: IntakeStatus;
  answers: IntakeAnswers; providerNote?: string; decidedBy?: string; decidedAt?: string;
}
