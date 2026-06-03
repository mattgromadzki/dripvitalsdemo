export interface Agreement { id: string; name: string; version: string; required: boolean; desc: string; }
export const AGREEMENTS: Agreement[] = [
  { id: "telehealth", name: "Telehealth Informed Consent", version: "v2.1", required: true, desc: "Consent to receive care via telehealth." },
  { id: "hipaa", name: "HIPAA Privacy Authorization", version: "v1.4", required: true, desc: "Use and disclosure of protected health information." },
  { id: "treatment", name: "GLP-1 Treatment Consent", version: "v1.2", required: true, desc: "Risks, benefits, and expectations of GLP-1 therapy." },
  { id: "autorefill", name: "Auto-Refill & Financial Authorization", version: "v1.0", required: true, desc: "Authorization for recurring billing and automatic refills." },
  { id: "id", name: "Identity Verification", version: "v1.0", required: true, desc: "Government ID verification for prescribing." },
  { id: "controlled", name: "Controlled Substance Agreement", version: "v1.1", required: false, desc: "Required only for controlled-substance prescriptions." },
];
export const getAgreement = (id: string) => AGREEMENTS.find((a) => a.id === id);
