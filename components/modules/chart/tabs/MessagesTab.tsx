"use client";

import { useEffect, useRef, useState, type ReactNode, type KeyboardEvent } from "react";
import { toast } from "@/lib/hooks/useToast";
import { SectionCard } from "@/components/modules/chart/SectionCard";
import type { Patient, PatientExtra } from "@/lib/types";

export function MessagesTab({ patient, extra }: { patient: Patient; extra: PatientExtra }) {
  // Local message thread state — seeded from extra but mutable in-session
  const [thread, setThread] = useState(extra.messages);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever the thread grows
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thread.length]);

  function sendMessage() {
    const text = draft.trim();
    if (!text) return;
    setThread((t) => [...t, { from: "Dr. Rivera", text, time: "Just now", me: true }]);
    setDraft("");
    toast("📤 Message sent securely");
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  }

  const initials = (patient.first[0] || "") + (patient.last[0] || "");

  return (
    <div className="grid grid-cols-[1fr_1fr] gap-4 max-[1100px]:grid-cols-1">
      {/* LEFT: Thread + composer */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden flex flex-col" style={{ height: 520 }}>
        <div className="flex items-center gap-2.5 py-3 px-5 bg-surface-2 border-b border-border">
          <div className="w-7 h-7 rounded-md flex items-center justify-center text-[13px] flex-shrink-0 border border-border bg-surface" style={{ background: "var(--color-blue-soft)", color: "var(--color-blue)" }}>
            💬
          </div>
          <div className="text-[13px] font-bold uppercase tracking-wider text-ink-2 flex-1">Secure Message Thread</div>
          <span
            className="text-[11px] font-bold py-1 px-2.5 rounded-pill border"
            style={{ color: "var(--color-green)", background: "var(--color-green-soft)", borderColor: "rgba(31,138,112,.2)" }}
          >
            🔒 HIPAA Encrypted
          </span>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto py-3.5 px-5 flex flex-col gap-2.5">
          {thread.length === 0 ? (
            <div className="text-center text-ink-muted py-6 text-[12.5px]">
              <div className="text-[32px] opacity-40 mb-2">💬</div>
              No messages yet
            </div>
          ) : (
            thread.map((m, i) => (
              <div key={i} className={`flex gap-2.5 ${m.me ? "flex-row-reverse" : ""}`}>
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10.5px] font-bold text-white flex-shrink-0"
                  style={{ background: m.me ? "var(--color-brand)" : patient.color }}
                >
                  {m.me ? "DR" : initials}
                </div>
                <div className="max-w-[80%]">
                  <div
                    className={`rounded-xl px-3 py-2 text-[13px] leading-snug whitespace-pre-wrap break-words ${
                      m.me ? "text-white" : "text-ink-2"
                    }`}
                    style={{ background: m.me ? "var(--color-brand)" : "var(--color-surface-3)" }}
                  >
                    {m.text}
                  </div>
                  <div className={`text-[10.5px] text-ink-muted mt-1 ${m.me ? "text-right" : ""}`}>{m.time}</div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="py-3 px-5 border-t border-border flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            placeholder="Type a secure message…"
            className="flex-1 py-2 px-3 border border-border rounded-md font-sans text-[13px] outline-none focus:border-brand focus:shadow-[0_0_0_3px_rgba(31,138,112,.18)] transition-all"
          />
          <button className="btn btn-primary btn-sm" onClick={sendMessage} disabled={!draft.trim()}>
            Send 📤
          </button>
        </div>
      </div>

      {/* RIGHT: Support tickets */}
      <div>
        <SectionCard
          title="Support History"
          icon="🎫"
          iconBg="var(--color-amber-soft)"
          iconColor="var(--color-amber)"
          action={
            <button className="btn btn-ghost btn-sm" onClick={() => toast("🎫 New support ticket")}>
              + New Ticket
            </button>
          }
        >
          {extra.supportNotes.length === 0 ? (
            <div className="py-8 text-center text-ink-muted">
              <div className="text-[32px] opacity-40 mb-2">✓</div>
              <div className="text-[12.5px] font-semibold text-ink mb-1">No support tickets</div>
              <div className="text-[11.5px]">{patient.first} has not contacted support yet</div>
            </div>
          ) : (
            <div className="-mx-5">
              {extra.supportNotes.map((n, i) => (
                <div key={i} className="py-3 px-5 border-b border-border last:border-none">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-[12.5px] text-ink">{n.agent}</span>
                    <span className="text-[11px] text-ink-muted font-mono">{n.date}</span>
                  </div>
                  <div className="text-[12.5px] text-ink-2 leading-relaxed">{n.note}</div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Communication Preferences"
          icon="⚙"
          iconBg="var(--color-purple-soft)"
          iconColor="var(--color-purple)"
        >
          <div className="grid grid-cols-2 gap-3">
            <Pref label="SMS Reminders" value="Enabled" />
            <Pref label="Email Updates" value="Enabled" />
            <Pref label="Marketing Emails" value="Disabled" />
            <Pref label="Quiet Hours" value="9pm – 8am" />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function Pref({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-2 border border-border rounded-[10px] px-4 py-3">
      <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted mb-1">{label}</div>
      <div className="text-[13px] font-semibold text-ink">{value}</div>
    </div>
  );
}
