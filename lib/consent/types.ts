export type ConsentStatus = "signed" | "pending" | "declined" | "expired";
export interface ConsentRecord {
  id: string; patientId: string; patientName: string;
  docId: string; docName: string; version: string; status: ConsentStatus;
  method?: string; sentAt?: string; signedAt?: string;
}
