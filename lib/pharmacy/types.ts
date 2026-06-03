// eMed pharmacy fulfillment API — shared types.
export interface EmedDrug {
  Name: string; DosageForm?: string; Sig: string; Notes?: string;
  Quantity: number; Refills: number; NDC?: string; IsControlled?: boolean;
}
export interface EmedPatient {
  UniqueId: string; FirstName: string; MiddleName?: string; LastName: string;
  Sex: string; DateOfBirth: string; Phone: string; Email: string;
  Address: string; City: string; State: string; Zip: string;
  Allergies?: string; MedicalConditions?: string; CurrentMedications?: string; IdJpg?: string;
}
export interface EmedShipping { Name: string; Phone: string; Address: string; City: string; State: string; Zip: string; }
export interface EmedPrescriber {
  FirstName: string; MiddleName?: string; LastName: string; Phone: string;
  Address: string; City: string; State: string; Zip: string; NPI: string; DEA?: string; SignatureJpg: string;
}
export interface EmedAttachment { FileName: string; Base64_Data: string; }
export interface EmedOrderPayload {
  Patient: EmedPatient; Shipping: EmedShipping; Prescriber: EmedPrescriber;
  Drug: EmedDrug[]; Attachments?: EmedAttachment[];
}
export interface EmedRxRef { Id: number; Drug: string; }
export interface EmedSubmitResult { ok: boolean; OrderId?: number; Rx?: EmedRxRef[]; error?: string; source: "emed" | "mock"; }
export interface EmedRxStatus {
  ok: boolean; OrderStatus?: string; RxId?: number; ScriptNumber?: number; DrugName?: string; Sigs?: string;
  ShipDate?: string; ShipmentType?: string; TrackingNumber?: string; LastModified?: string; error?: string; source: "emed" | "mock";
}
export interface EmedOrderStatus {
  ok: boolean; OrderId?: number; Status?: string; Prescriber?: string; Pharmacy?: string;
  ShipStatus?: string; ShipDate?: string; ShipmentType?: string; ShippingAddress?: string;
  PackageCount?: number; TrackingNumber?: string; Prescriptions?: EmedRxStatus[]; error?: string; source: "emed" | "mock";
}
export interface EmedCancelResult { ok: boolean; message?: string; error?: string; source: "emed" | "mock"; }

export const EMED_STATUSES = ["Received", "Reviewing", "Filling", "Verifying", "Ready", "Picked Up", "Shipped"] as const;
