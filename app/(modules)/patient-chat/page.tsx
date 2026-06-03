"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Toast } from "@/components/ui/Toast";
import { toast } from "@/lib/hooks/useToast";
import { usePatients } from "@/lib/hooks/usePatients";
import { usePortalRecords } from "@/lib/hooks/usePortalRecords";
import { useChatReads, unreadForPid } from "@/lib/hooks/useChatReads";
import { sendChat, pullAllChat } from "@/lib/chat/client";
import { getPatientExtra } from "@/lib/data/patientExtras";
import { seedRecordFromPatient } from "@/lib/data/portalRecords";

export default function PatientChatPage() {
  const patients = usePatients((s) => s.patients);
  const records = usePortalRecords((s) => s.records);
  const hydrate = usePortalRecords((s) => s.hydrate);
  const ensureSeeded = usePortalRecords((s) => s.ensureSeeded);
  const addMessage = usePortalRecords((s) => s.addMessage);
  const seen = useChatReads((s) => s.seen);
  const hydrateSeen = useChatReads((s) => s.hydrate);
  const initMissing = useChatReads((s) => s.initMissing);
  const markSeen = useChatReads((s) => s.markSeen);

  const [selPid, setSelPid] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  const prevCounts = useRef<Record<string, number>>({});
  const inited = useRef(false);

  // Load the shared (localStorage-mirrored) store and seed each patient's
  // starting thread so support sees real history; the portal writes here too.
  useEffect(() => {
    hydrate(); hydrateSeen();
    patients.forEach((p) => ensureSeeded(p.id, seedRecordFromPatient(p, getPatientExtra(p))));
  }, [patients, hydrate, hydrateSeen, ensureSeeded]);

  // Live: when another tab (the patient portal) writes a message, re-hydrate
  // so this screen updates automatically without a manual refresh.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (!e.key || e.key === "dv_portal_records_v2" || e.key === "dv_chat_seen_v1") { hydrate(); hydrateSeen(); } };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [hydrate, hydrateSeen]);

  // Sync all chat threads from the shared server every few seconds so messages
  // from patients (on their own devices) appear here across the patient list.
  useEffect(() => {
    pullAllChat();
    const t = setInterval(pullAllChat, 5000);
    return () => clearInterval(t);
  }, []);

  const rows = useMemo(() => patients.map((p) => {
    const msgs = records[p.id]?.messages ?? [];
    const last = msgs[msgs.length - 1];
    return { p, count: msgs.length, lastText: last ? (last.attachment ? `📎 ${last.attachment.name}` : last.text) : "", lastFrom: last?.from };
  }).sort((a, b) => b.count - a.count), [patients, records]);

  const filtered = rows.filter((r) => !search || r.p.name.toLowerCase().includes(search.toLowerCase()) || r.p.id.toLowerCase().includes(search.toLowerCase()));

  const activePid = selPid ?? filtered.find((r) => r.count > 0)?.p.id ?? filtered[0]?.p.id ?? null;
  const active = patients.find((p) => p.id === activePid) || null;
  const messages = activePid ? (records[activePid]?.messages ?? []) : [];

  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [messages.length, activePid]);

  // Announce incoming patient messages; keep "seen" baseline + active thread read.
  useEffect(() => {
    const counts: Record<string, number> = {};
    patients.forEach((p) => { counts[p.id] = records[p.id]?.messages.length ?? 0; });
    initMissing(records);
    if (!inited.current) { prevCounts.current = counts; inited.current = true; }
    else {
      patients.forEach((p) => {
        if (counts[p.id] > (prevCounts.current[p.id] ?? 0)) {
          const msgs = records[p.id]?.messages ?? [];
          const last = msgs[msgs.length - 1];
          if (last && last.from === "patient" && p.id !== activePid) toast(`💬 New message from ${p.name}`);
        }
      });
      prevCounts.current = counts;
    }
    if (activePid) markSeen(activePid, counts[activePid] ?? 0);
  }, [records, patients, activePid, initMissing, markSeen]);

  function open(pid: string) {
    setSelPid(pid);
    markSeen(pid, records[pid]?.messages.length ?? 0);
  }

  function send() {
    const t = draft.trim();
    if (!t || !activePid) return;
    sendChat(activePid, { from: "care", text: t, time: "Just now" });
    setDraft("");
  }
  function attach(file: File) {
    if (!activePid || !file) return;
    const kind: "image" | "pdf" = file.type.startsWith("image/") ? "image" : "pdf";
    const reader = new FileReader();
    reader.onload = () => sendChat(activePid, { from: "care", text: "", time: "Just now", attachment: { name: file.name, kind, url: String(reader.result) } });
    reader.readAsDataURL(file);
  }

  return (
    <div className="px-7 py-6 text-[14px]">
      <div className="mb-4">
        <h1 className="text-[21px] font-extrabold tracking-tight">Patient Chat</h1>
        <div className="text-[12px] text-ink-muted mt-0.5">Two-way support chat · connected live with each patient's portal Chat tab</div>
      </div>

      <div className="flex bg-surface border border-border rounded-xl overflow-hidden" style={{ height: "calc(100vh - 150px)" }}>
        {/* Conversation list */}
        <div className="w-[320px] min-w-[280px] border-r border-border flex flex-col">
          <div className="p-2.5 border-b border-border">
            <div className="flex items-center gap-2 bg-surface-2 border border-border rounded-[9px] px-3 py-2">
              <span className="text-ink-muted">🔍</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patients…" className="bg-transparent outline-none text-[12.5px] w-full" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.map(({ p, count, lastText, lastFrom }) => (
              <button key={p.id} onClick={() => open(p.id)}
                className={`w-full text-left flex items-center gap-3 px-3 py-2.5 border-b border-border hover:bg-surface-2 ${activePid === p.id ? "bg-brand-soft" : ""}`}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-[12px] flex-shrink-0" style={{ background: p.color }}>{(p.first[0] || "") + (p.last[0] || "")}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between items-center gap-2"><span className="font-semibold text-[13px] truncate">{p.name}</span>{unreadForPid(records, seen, p.id) > 0 && <span className="w-2 h-2 rounded-full bg-red flex-shrink-0" />}</div>
                  <div className={`text-[11.5px] truncate ${unreadForPid(records, seen, p.id) > 0 ? "text-ink font-semibold" : "text-ink-muted"}`}>{count ? `${lastFrom === "care" ? "You: " : ""}${lastText}` : "No messages yet"}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Thread */}
        <div className="flex-1 flex flex-col min-w-0">
          {active ? (
            <>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-[12px]" style={{ background: active.color }}>{(active.first[0] || "") + (active.last[0] || "")}</div>
                <div className="flex-1">
                  <div className="font-bold">{active.name}</div>
                  <div className="text-[11.5px] text-ink-muted">{active.id} · {active.plan}</div>
                </div>
                <Link href={`/patients/${active.id}`} className="text-[12px] font-semibold text-brand-dk hover:underline">Open chart →</Link>
              </div>

              <div ref={bodyRef} className="flex-1 overflow-y-auto p-4 bg-surface-2">
                {messages.length === 0 && <div className="text-center text-ink-muted text-[12px] py-10">No messages yet — start the conversation.</div>}
                {messages.map((m, i) => {
                  const mine = m.from === "care";
                  return (
                    <div key={i} className={`flex flex-col mb-2.5 ${mine ? "items-end" : "items-start"}`}>
                      <div className={`max-w-[72%] px-3 py-2 rounded-2xl text-[13px] ${mine ? "bg-brand text-white rounded-br-sm" : "bg-surface border border-border rounded-bl-sm"}`}>
                        {m.attachment && (m.attachment.kind === "image"
                          ? <img src={m.attachment.url} alt={m.attachment.name} className="max-w-[200px] rounded-lg block" style={{ marginBottom: m.text ? 6 : 0 }} />
                          : <a href={m.attachment.url} download={m.attachment.name} className="flex items-center gap-2 font-semibold no-underline" style={{ color: "inherit", marginBottom: m.text ? 6 : 0 }}>📄 {m.attachment.name}</a>)}
                        {m.text && <span>{m.text}</span>}
                      </div>
                      <div className="text-[10px] text-ink-muted-2 mt-1 px-1">{m.time}</div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 p-3 border-t border-border">
                <label className="btn btn-ghost cursor-pointer" title="Attach photo or PDF">📎
                  <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) attach(f); e.currentTarget.value = ""; }} />
                </label>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                  placeholder={`Reply to ${active.first}…`} className="flex-1 bg-surface-2 border border-border rounded-full px-4 py-2.5 text-[13px] outline-none" />
                <button className="btn btn-primary" onClick={send}>Send</button>
              </div>
            </>
          ) : <div className="flex-1 flex items-center justify-center text-ink-muted text-[13px]">Select a conversation</div>}
        </div>
      </div>
      <Toast />
    </div>
  );
}
