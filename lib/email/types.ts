export type EmailStatus = "sent" | "delivered" | "draft" | "failed" | "received";
export type Folder = "inbox" | "sent" | "drafts" | "starred" | "archive" | "trash";
export interface Attachment { name: string; sizeKb?: number }
export interface EmailMessage {
  id: string;
  threadId?: string;
  folder: Folder;
  direction: "in" | "out";
  fromName: string;
  fromEmail: string;
  to: string;
  toName?: string;
  subject: string;
  html: string;
  preview: string;
  templateId?: string;
  status: EmailStatus;
  read: boolean;
  starred: boolean;
  providerId?: string;
  createdAt: string;
  attachments?: Attachment[];
}
export interface SendEmailInput { to: string; toName?: string; subject: string; html: string; templateId?: string; from?: string }
export interface SendEmailResult { ok: boolean; id?: string; error?: string; provider: string }

export function htmlToPreview(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);
}
