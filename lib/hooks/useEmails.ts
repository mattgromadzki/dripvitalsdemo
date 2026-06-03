"use client";
import { create } from "@/lib/hooks/zustand-shim";
import type { EmailMessage, Folder } from "@/lib/email/types";
import { htmlToPreview } from "@/lib/email/types";

const mk = (m: Omit<EmailMessage, "preview">): EmailMessage => ({ ...m, preview: htmlToPreview(m.html) });

const SEED: EmailMessage[] = [
  mk({ id: "EM-1008", folder: "sent", direction: "out", fromName: "DripVitals", fromEmail: "care@dripvitals.com", to: "sarah.lin@example.com", toName: "Sarah Lin", subject: "Your weight-loss journey starts now 🎉", templateId: undefined, status: "delivered", read: true, starred: true, providerId: "re_seed_8", createdAt: "2026-06-01T15:30:00Z",
    html: `<div style="max-width:560px;margin:0 auto;font-family:Helvetica,Arial,sans-serif;border:1px solid #e6e9ef;border-radius:14px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#2f6df6,#1e4fd6);padding:28px 32px;color:#fff">
    <div style="font-size:20px;font-weight:800;letter-spacing:-.3px">DripVitals</div>
  </div>
  <div style="padding:28px 32px;color:#1d2733">
    <h1 style="font-size:22px;margin:0 0 12px">Welcome aboard, Sarah!</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 16px">Your provider has approved your plan and your first shipment is being prepared. Here's what happens next.</p>
    <ul style="font-size:14px;line-height:1.7;color:#475467;padding-left:18px;margin:0 0 22px">
      <li>Your medication ships within 2 business days</li>
      <li>Track everything from your patient portal</li>
      <li>Message your care team anytime</li>
    </ul>
    <a href="https://dripvitals.com/portal" style="display:inline-block;background:#2f6df6;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px">Open my portal</a>
  </div>
  <div style="padding:18px 32px;background:#f6f8fb;color:#98a2b3;font-size:12px;text-align:center">DripVitals · 100 Compound Ave, Miami FL · Unsubscribe</div>
</div>` }),
  mk({ id: "EM-1007", folder: "inbox", direction: "in", fromName: "Sarah Lin", fromEmail: "sarah.lin@example.com", to: "care@dripvitals.com", toName: "DripVitals Care", subject: "Re: Welcome to DripVitals, Sarah!", html: "<p>Thank you! Quick question — should I take my first dose in the morning or evening?</p><p>Sarah</p>", status: "received", read: false, starred: false, createdAt: "2026-06-01T13:20:00Z" }),
  mk({ id: "EM-1006", folder: "inbox", direction: "in", fromName: "James Carter", fromEmail: "james.carter@example.com", to: "care@dripvitals.com", subject: "Tracking number?", html: "<p>Hi, has my order shipped yet? I'd love the tracking number when you have it.</p><p>Thanks,<br>James</p>", status: "received", read: false, starred: true, createdAt: "2026-06-01T09:05:00Z" }),
  mk({ id: "EM-1005", folder: "inbox", direction: "in", fromName: "Maria Gomez", fromEmail: "maria.g@example.com", to: "care@dripvitals.com", subject: "Insurance question", html: "<p>Does my plan cover the compounded option? Let me know what you need from me.</p>", status: "received", read: true, starred: false, createdAt: "2026-05-31T16:40:00Z" }),
  mk({ id: "EM-1003", folder: "sent", direction: "out", fromName: "DripVitals Care", fromEmail: "care@dripvitals.com", to: "michael.g@example.com", toName: "Michael Gromadzki", subject: "Your Compounded Semaglutide refill is coming up", html: "<p>Hi Michael,</p><p>This is a reminder that your <b>Compounded Semaglutide</b> refill is due around <b>Jun 5</b>.</p><p>— DripVitals</p>", templateId: "refill_reminder", status: "delivered", read: true, starred: false, providerId: "re_seed_3", createdAt: "2026-05-30T14:10:00Z" }),
  mk({ id: "EM-1002", folder: "sent", direction: "out", fromName: "DripVitals Care", fromEmail: "care@dripvitals.com", to: "sarah.lin@example.com", toName: "Sarah Lin", subject: "Welcome to DripVitals, Sarah!", html: "<p>Hi Sarah,</p><p>Welcome to <b>DripVitals</b>! Your account is set up and our care team is reviewing your intake.</p><p>— The DripVitals Care Team</p>", templateId: "welcome", status: "delivered", read: true, starred: false, providerId: "re_seed_2", createdAt: "2026-05-29T09:02:00Z" }),
  mk({ id: "EM-1001", folder: "sent", direction: "out", fromName: "DripVitals Care", fromEmail: "care@dripvitals.com", to: "james.carter@example.com", toName: "James Carter", subject: "Your DripVitals order has shipped", html: "<p>Hi James,</p><p>Good news — your order is on its way.</p><p>— DripVitals</p>", templateId: "shipment", status: "sent", read: true, starred: false, providerId: "re_seed_1", createdAt: "2026-05-28T17:45:00Z" }),
  mk({ id: "EM-1004", folder: "drafts", direction: "out", fromName: "DripVitals Care", fromEmail: "care@dripvitals.com", to: "maria.g@example.com", toName: "Maria Gomez", subject: "Re: Insurance question", html: "<p>Hi Maria,</p><p>Great question about coverage — </p>", status: "draft", read: true, starred: false, createdAt: "2026-05-31T17:02:00Z" }),
];

interface State {
  emails: EmailMessage[];
  seq: number;
  add: (m: Omit<EmailMessage, "id" | "preview"> & { preview?: string }) => EmailMessage;
  update: (id: string, patch: Partial<EmailMessage>) => void;
  move: (id: string, folder: Folder) => void;
  toggleStar: (id: string) => void;
  markRead: (id: string, read?: boolean) => void;
  remove: (id: string) => void;
}

export const useEmails = create<State>((set) => ({
  emails: SEED,
  seq: 1008,
  add: (input) => {
    let created: EmailMessage = { id: "EM-0", preview: "", ...input } as EmailMessage;
    set((s) => {
      created = { ...(input as EmailMessage), id: "EM-" + s.seq, preview: htmlToPreview(input.html) };
      return { emails: [created, ...s.emails], seq: s.seq + 1 };
    });
    return created;
  },
  update: (id, patch) => set((s) => ({ emails: s.emails.map((e) => (e.id === id ? { ...e, ...patch, ...(patch.html != null ? { preview: htmlToPreview(patch.html) } : {}) } : e)) })),
  move: (id, folder) => set((s) => ({ emails: s.emails.map((e) => (e.id === id ? { ...e, folder } : e)) })),
  toggleStar: (id) => set((s) => ({ emails: s.emails.map((e) => (e.id === id ? { ...e, starred: !e.starred } : e)) })),
  markRead: (id, read = true) => set((s) => ({ emails: s.emails.map((e) => (e.id === id ? { ...e, read } : e)) })),
  remove: (id) => set((s) => {
    const e = s.emails.find((x) => x.id === id);
    if (e && e.folder !== "trash") return { emails: s.emails.map((x) => (x.id === id ? { ...x, folder: "trash" as Folder } : x)) };
    return { emails: s.emails.filter((x) => x.id !== id) };
  }),
}));
