"use client";

import { useMemo, useState } from "react";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { toast } from "@/lib/hooks/useToast";
import { useEmails } from "@/lib/hooks/useEmails";
import { ComposeWindow, type ComposeInit } from "@/components/modules/emails/ComposeWindow";
import { EmailFrame } from "@/components/modules/emails/EmailFrame";
import type { EmailMessage, Folder } from "@/lib/email/types";

const AVATAR_COLORS = ["#2f6df6", "#0e9f6e", "#7c3aed", "#f59e0b", "#ef4444", "#0ea5e9", "#db2777", "#14b8a6"];
function avatar(name: string) {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return { initial: (name.trim()[0] || "?").toUpperCase(), color: AVATAR_COLORS[h % AVATAR_COLORS.length] };
}

const FOLDERS: { key: Folder; label: string; icon: string }[] = [
  { key: "inbox", label: "Inbox", icon: "📥" },
  { key: "starred", label: "Starred", icon: "⭐" },
  { key: "sent", label: "Sent", icon: "📤" },
  { key: "drafts", label: "Drafts", icon: "📝" },
  { key: "archive", label: "Archive", icon: "🗄" },
  { key: "trash", label: "Trash", icon: "🗑" },
];
const fmtShort = (iso: string) => { const d = new Date(iso); const today = new Date(); return d.toDateString() === today.toDateString() ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
const fmtFull = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const stripRe = (s: string) => s.replace(/^((re|fwd):\s*)+/i, "");

export default function EmailsPage() {
  const emails = useEmails((s) => s.emails);
  const add = useEmails((s) => s.add);
  const update = useEmails((s) => s.update);
  const move = useEmails((s) => s.move);
  const toggleStar = useEmails((s) => s.toggleStar);
  const markRead = useEmails((s) => s.markRead);
  const remove = useEmails((s) => s.remove);

  const [folder, setFolder] = useState<Folder>("inbox");
  const [selId, setSelId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [compose, setCompose] = useState<ComposeInit | null>(null);

  const inFolder = (e: EmailMessage) => (folder === "starred" ? e.starred && e.folder !== "trash" : e.folder === folder);
  const list = useMemo(() => emails.filter(inFolder).filter((e) => {
    if (!search) return true; const q = search.toLowerCase();
    return e.subject.toLowerCase().includes(q) || e.fromName.toLowerCase().includes(q) || e.to.toLowerCase().includes(q) || (e.toName || "").toLowerCase().includes(q) || e.preview.toLowerCase().includes(q);
  }), [emails, folder, search]);

  const inboxUnread = emails.filter((e) => e.folder === "inbox" && !e.read).length;
  const draftCount = emails.filter((e) => e.folder === "drafts").length;
  const sel = selId ? emails.find((e) => e.id === selId) || null : null;

  function openMessage(e: EmailMessage) {
    if (e.folder === "drafts") { setCompose({ to: e.to, toName: e.toName, subject: e.subject, html: e.html, templateId: e.templateId, replaceId: e.id }); return; }
    setSelId(e.id); if (!e.read) markRead(e.id, true);
  }
  function onComposeResult(msg: Omit<EmailMessage, "id" | "preview">, replaceId?: string) {
    if (replaceId) update(replaceId, msg);
    else add(msg);
    toast(msg.status === "draft" ? "Draft saved" : "✉️ Email sent");
  }
  function reply(e: EmailMessage) {
    setCompose({ to: e.direction === "in" ? e.fromEmail : e.to, toName: e.direction === "in" ? e.fromName : e.toName, subject: "Re: " + stripRe(e.subject), html: `<p><br></p><blockquote>On ${fmtFull(e.createdAt)}, ${e.fromName} wrote:<br>${e.html}</blockquote>` });
  }
  function forward(e: EmailMessage) {
    setCompose({ subject: "Fwd: " + stripRe(e.subject), html: `<p><br></p><blockquote>---------- Forwarded message ----------<br>From: ${e.fromName} &lt;${e.fromEmail}&gt;<br>Subject: ${e.subject}<br><br>${e.html}</blockquote>` });
  }

  const ActionBtn = ({ on, label, title }: { on: () => void; label: string; title: string }) => (
    <button onClick={on} title={title} className="h-8 px-2.5 rounded-md text-[12.5px] font-semibold text-ink-2 hover:bg-surface-3 flex items-center gap-1">{label}</button>
  );

  return (
    <div className="px-5 py-4 text-[14px]">
      <div className="flex items-center gap-3 mb-3">
        <h1 className="text-[20px] font-extrabold tracking-tight">Emails</h1>
        <div className="flex-1" />
        <button className="btn btn-primary btn-sm" onClick={() => setCompose({})}>✏️ Compose</button>
      </div>

      <div className="flex border border-border rounded-xl overflow-hidden bg-surface" style={{ height: "calc(100vh - 132px)", minHeight: 520 }}>
        {/* Folder rail */}
        <div className="w-[176px] shrink-0 border-r border-border py-2 bg-surface-2/40">
          {FOLDERS.map((f) => {
            const active = folder === f.key;
            const badge = f.key === "inbox" && inboxUnread ? inboxUnread : f.key === "drafts" && draftCount ? draftCount : undefined;
            return (
              <button key={f.key} onClick={() => { setFolder(f.key); setSelId(null); }}
                className={`w-full flex items-center gap-2.5 px-4 py-2 text-[13px] ${active ? "bg-brand-soft text-brand-dk font-bold border-r-2 border-brand" : "text-ink-2 hover:bg-surface-3"}`}>
                <span>{f.icon}</span><span className="flex-1 text-left">{f.label}</span>
                {badge != null && <span className="text-[10.5px] font-bold bg-brand text-white rounded-full px-1.5 min-w-[18px] text-center">{badge}</span>}
              </button>
            );
          })}
        </div>

        {/* Message list */}
        <div className="w-[340px] shrink-0 border-r border-border flex flex-col">
          <div className="p-2 border-b border-border">
            <div className="flex items-center gap-2 bg-surface-2 border border-border rounded-lg px-2.5 py-1.5">
              <span className="text-ink-muted text-[13px]">🔍</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search mail" className="bg-transparent outline-none text-[12.5px] w-full" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {list.map((e) => {
              const who = e.direction === "in" ? e.fromName : e.toName || e.to;
              const av = avatar(who);
              return (
                <div key={e.id} onClick={() => openMessage(e)}
                  className={`px-3 py-2.5 border-b border-border cursor-pointer hover:bg-surface-2 ${selId === e.id ? "bg-brand-soft/60" : ""} ${!e.read ? "bg-blue-soft/30" : ""}`}>
                  <div className="flex gap-2.5">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold shrink-0" style={{ background: av.color }}>{av.initial}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`flex-1 truncate text-[13px] ${!e.read ? "font-extrabold" : "font-semibold"}`}>{who}</span>
                        <button onClick={(ev) => { ev.stopPropagation(); toggleStar(e.id); }} className={e.starred ? "text-amber" : "text-ink-muted-2 hover:text-amber"} title="Star">{e.starred ? "★" : "☆"}</button>
                        <span className="text-[10.5px] text-ink-muted whitespace-nowrap">{fmtShort(e.createdAt)}</span>
                      </div>
                      <div className={`text-[12.5px] truncate ${!e.read ? "font-semibold" : ""}`}>{e.subject || "(no subject)"}</div>
                      <div className="text-[11.5px] text-ink-muted truncate">{e.preview}</div>
                    </div>
                  </div>
                </div>
              );
            })}
            {list.length === 0 && <div className="px-4 py-10 text-center text-ink-muted text-[12px]">Nothing here.</div>}
          </div>
        </div>

        {/* Reading pane */}
        <div className="flex-1 flex flex-col min-w-0">
          {sel ? (
            <>
              <div className="flex items-center gap-1 px-3 py-2 border-b border-border flex-wrap">
                <ActionBtn on={() => reply(sel)} label="↩ Reply" title="Reply" />
                <ActionBtn on={() => forward(sel)} label="↪ Forward" title="Forward" />
                <ActionBtn on={() => { move(sel.id, "archive"); setSelId(null); toast("Archived"); }} label="🗄 Archive" title="Archive" />
                <ActionBtn on={() => { remove(sel.id); setSelId(null); toast("Moved to Trash"); }} label="🗑 Delete" title="Delete" />
                <ActionBtn on={() => toggleStar(sel.id)} label={sel.starred ? "★ Starred" : "☆ Star"} title="Star" />
                <ActionBtn on={() => { markRead(sel.id, false); setSelId(null); }} label="✉ Unread" title="Mark unread" />
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <h2 className="text-[19px] font-extrabold tracking-tight mb-3">{sel.subject || "(no subject)"}</h2>
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
                  <div className="w-9 h-9 rounded-full text-white flex items-center justify-center font-bold text-[13px]" style={{ background: avatar(sel.fromName).color }}>{avatar(sel.fromName).initial}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold">{sel.fromName} <span className="text-ink-muted font-normal">&lt;{sel.fromEmail}&gt;</span></div>
                    <div className="text-[11.5px] text-ink-muted">to {sel.toName || sel.to} · {fmtFull(sel.createdAt)}</div>
                  </div>
                  <Pill intent={sel.status === "delivered" ? "green" : sel.status === "received" ? "blue" : sel.status === "failed" ? "red" : sel.status === "draft" ? "muted" : "blue"} dot>{sel.status}</Pill>
                </div>
                <EmailFrame html={sel.html} minHeight={160} />
                {sel.attachments && sel.attachments.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-border flex flex-wrap gap-2">
                    {sel.attachments.map((a, i) => <span key={i} className="inline-flex items-center gap-1.5 text-[12px] bg-surface-2 border border-border rounded-lg px-3 py-1.5">📎 {a.name}{a.sizeKb ? ` · ${a.sizeKb} KB` : ""}</span>)}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center text-ink-muted">
              <div><div className="text-[40px] mb-2">✉️</div><div className="text-[13px]">Select a message to read</div></div>
            </div>
          )}
        </div>
      </div>

      {compose && <ComposeWindow init={compose} onClose={() => setCompose(null)} onResult={onComposeResult} />}
      <Toast />
    </div>
  );
}
