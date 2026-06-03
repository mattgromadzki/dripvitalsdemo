export type SmsStatus = "queued" | "sent" | "delivered" | "failed" | "received";
export interface SmsMessage { id: string; direction: "in" | "out"; body: string; status: SmsStatus; providerId?: string; createdAt: string; }
export interface SmsThread { id: string; name: string; phone: string; patientId?: string; unread: number; messages: SmsMessage[]; }
export interface SendSmsInput { to: string; body: string; statusCallback?: string; }
export interface SendSmsResult { ok: boolean; id?: string; status?: string; error?: string; provider: string; }

// An inbound SMS received from Twilio's webhook (patient → us).
export interface InboundSms { sid: string; from: string; to: string; body: string; receivedAt: string; }
