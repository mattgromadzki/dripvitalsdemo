// Life File (LifeFile) API — types for POST /order + PUT status.
export interface LFRx {
  rxType: "new" | "refill";
  drugName: string;
  drugStrength?: string;
  drugForm?: string;
  lfProductID?: number;
  rxNumber?: number;
  foreignPmsId?: number;
  foreignRxNumber?: string;
  quantity?: string;
  quantityUnits?: string;
  directions?: string;
  refills?: number;
  dateWritten?: string;
  daysSupply?: number;
  scheduleCode?: "2" | "3" | "4" | "5" | "L" | "O";
  clinicalDifferenceStatement?: string;
}
export interface LFOrderBody {
  message: { id: number; sentTime?: string };
  order: {
    general?: { memo?: string; referenceId?: string; statusId?: string };
    document?: { pdfBase64?: string };
    prescriber: { npi: string; licenseState?: string; licenseNumber?: string; dea?: string; lastName: string; firstName?: string; address1?: string; city?: string; state?: string; zip?: string; phone?: string; email?: string };
    practice?: { id: number };
    patient: { lastName: string; firstName: string; middleName?: string; gender: "m" | "f" | "a" | "u"; dateOfBirth: string; address1?: string; city?: string; state?: string; zip?: string; phoneMobile?: string; email?: string };
    shipping?: { recipientType: "clinic" | "patient"; recipientLastName?: string; recipientFirstName?: string; recipientPhone?: string; recipientEmail?: string; addressLine1?: string; addressLine2?: string; city?: string; state?: string; zipCode?: string; country?: string; service?: number };
    billing?: { payorType: "pat" | "doc" };
    rxs: LFRx[];
  };
}
export interface LFResult { ok: boolean; type?: "success" | "error"; message?: string; orderId?: number | string; data?: unknown; error?: string; source: "lifefile" | "mock"; }
