export type SmsStatus = "queued" | "sent" | "delivered" | "failed" | "received";
export interface SmsMessage { id: string; direction: "in" | "out"; body: string; status: SmsStatus; providerId?: string; createdAt: string; }
export interface SmsThread { id: string; name: string; phone: string; patientId?: string; unread: number; messages: SmsMessage[]; }
export interface SendSmsInput { to: string; body: string; }
export interface SendSmsResult { ok: boolean; id?: string; status?: string; error?: string; provider: string; }
