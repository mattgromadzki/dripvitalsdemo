"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { toast } from "@/lib/hooks/useToast";
import { useSoapNotes } from "@/lib/hooks/useSoapNotes";
import { usePatients } from "@/lib/hooks/usePatients";
import { SOAP_TEMPLATES, type SoapTemplate } from "@/lib/data/soapTemplates";
import type { SoapNote, SoapNoteStatus } from "@/lib/types";

type Filter = "all" | "draft" | "signed";

export default function SoapNotesPage() {
  const notes         = useSoapNotes((s) => s.notes);
  const addNote       = useSoapNotes((s) => s.add);
  const updateSection = useSoapNotes((s) => s.updateSection);
  const updateMeta    = useSoapNotes((s) => s.updateMeta);
  const signNote      = useSoapNotes((s) => s.sign);
  const removeNote    = useSoapNotes((s) => s.remove);
  const patients      = usePatients((s) => s.patients);

  const [activeId, setActiveId] = useState<number | null>(notes[0]?.id ?? null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [signOpen, setSignOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);

  // Filtered + searched list
  const filteredNotes = useMemo(() => {
    let list = notes;
    if (filter !== "all") list = list.filter((n) => n.status === filter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((n) =>
        n.patientName.toLowerCase().includes(q) ||
        n.type.toLowerCase().includes(q) ||
        n.provider.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => b.dateOrdered - a.dateOrdered);
  }, [notes, filter, search]);

  // If active note disappears from filtered list, snap to first
  useEffect(() => {
    if (activeId !== null && !notes.find((n) => n.id === activeId)) {
      setActiveId(notes[0]?.id ?? null);
    }
  }, [notes, activeId]);

  const activeNote = notes.find((n) => n.id === activeId);
  const isLocked = activeNote?.status === "signed";
  const activePatient = activeNote?.patientId
    ? patients.find((p) => p.id === activeNote.patientId)
    : undefined;

  // Counts for filter badges
  const counts = useMemo(() => ({
    all: notes.length,
    draft: notes.filter((n) => n.status === "draft").length,
    signed: notes.filter((n) => n.status === "signed").length,
  }), [notes]);

  function handleSectionChange(field: "s" | "o" | "a" | "p", value: string) {
    if (!activeNote || isLocked) return;
    updateSection(activeNote.id, field, value);
    // Show auto-save flash briefly
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 800);
  }

  function handleNewNote() {
    const today = new Date();
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const dateStr = `${months[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;
    const dateOrdered = parseInt(`${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`, 10);
    const firstPatient = patients[0];
    const created = addNote({
      patientName: firstPatient?.name || "New Patient",
      patientId: firstPatient?.id,
      date: dateStr,
      dateOrdered,
      type: "New Note",
      status: "draft",
      provider: "Dr. Rivera",
      s: "", o: "", a: "", p: "",
    });
    setActiveId(created.id);
    toast("📝 New note draft created");
  }

  function handleApplyTemplate(t: SoapTemplate) {
    if (!activeNote || isLocked) return;
    updateMeta(activeNote.id, { type: t.type });
    updateSection(activeNote.id, "s", t.s);
    updateSection(activeNote.id, "o", t.o);
    updateSection(activeNote.id, "a", t.a);
    updateSection(activeNote.id, "p", t.p);
    toast(`📋 ${t.label} template applied`);
  }

  function handleSign() {
    if (!activeNote) return;
    signNote(activeNote.id);
    setSignOpen(false);
    toast("✍️ Note signed & locked · Saved to EMR");
  }

  function handleDelete() {
    if (!activeNote) return;
    const name = activeNote.patientName;
    removeNote(activeNote.id);
    setDeleteOpen(false);
    toast(`🗑 Note for ${name} deleted`);
  }

  function handlePatientChange(patientId: string) {
    if (!activeNote || isLocked) return;
    const p = patients.find((px) => px.id === patientId);
    if (!p) return;
    updateMeta(activeNote.id, { patientId: p.id, patientName: p.name });
  }

  return (
    <div className="px-7 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="text-[22px] font-bold tracking-tight text-ink mb-1">SOAP Visit Notes</div>
          <div className="text-[13px] text-ink-muted">
            Structured clinical documentation · Sign &amp; lock to EMR
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => activeNote && toast("💾 Draft saved")}
            disabled={!activeNote || isLocked}
          >
            💾 Save Draft
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setSignOpen(true)}
            disabled={!activeNote || isLocked}
          >
            ✍️ Sign &amp; Lock
          </button>
        </div>
      </div>

      {/* 3-column layout */}
      <div className="grid grid-cols-[280px_1fr_240px] gap-3.5 max-[1200px]:grid-cols-[260px_1fr] max-[900px]:grid-cols-1" style={{ minHeight: "calc(100vh - 200px)" }}>
        {/* LEFT RAIL — Notes list */}
        <div className="bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
          <div className="py-2.5 px-3 border-b border-border bg-surface-2">
            <button className="btn btn-primary btn-sm w-full justify-center" onClick={handleNewNote}>
              + New Note
            </button>
          </div>

          <div className="py-2 px-3 border-b border-border bg-surface-2">
            <div className="flex items-center gap-1 mb-2">
              <FilterChip active={filter === "all"}    count={counts.all}    onClick={() => setFilter("all")}>All</FilterChip>
              <FilterChip active={filter === "draft"}  count={counts.draft}  onClick={() => setFilter("draft")}>Drafts</FilterChip>
              <FilterChip active={filter === "signed"} count={counts.signed} onClick={() => setFilter("signed")}>Signed</FilterChip>
            </div>
            <div className="flex items-center gap-1.5 bg-surface border border-border rounded py-1 px-2">
              <span className="text-ink-muted text-[12px]">🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="flex-1 bg-transparent border-none outline-none text-[12px] text-ink placeholder:text-ink-muted min-w-0"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredNotes.length === 0 ? (
              <div className="py-8 text-center text-ink-muted px-4">
                <div className="text-[28px] opacity-40 mb-2">📝</div>
                <div className="text-[12px] font-bold text-ink mb-1">No notes</div>
                <div className="text-[11px]">{search ? "Try a different search" : "Click \u201C+ New Note\u201D"}</div>
              </div>
            ) : (
              filteredNotes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setActiveId(n.id)}
                  className={[
                    "w-full text-left py-2.5 px-3 border-b border-border last:border-none transition-colors flex flex-col gap-1",
                    activeId === n.id
                      ? "bg-brand-soft border-l-[3px] border-l-brand"
                      : "hover:bg-surface-2",
                  ].join(" ")}
                  style={activeId === n.id ? { borderLeftWidth: 3, borderLeftColor: "var(--color-brand)" } : undefined}
                >
                  <div className="text-[10px] font-mono text-ink-muted">{n.date}</div>
                  <div className="text-[12.5px] font-semibold text-ink truncate">{n.patientName}</div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-ink-muted truncate flex-1">{n.type}</span>
                    <Pill intent={n.status === "signed" ? "green" : n.status === "amended" ? "amber" : "muted"}>
                      {n.status === "signed" ? "✓ Signed" : n.status[0].toUpperCase() + n.status.slice(1)}
                    </Pill>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* CENTER — Editor */}
        <div className="bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
          {!activeNote ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="text-center text-ink-muted">
                <div className="text-[42px] opacity-40 mb-2">📝</div>
                <div className="text-[14px] font-bold mb-1 text-ink">No note selected</div>
                <div className="text-[12px]">Pick one from the list or click &ldquo;+ New Note&rdquo;</div>
              </div>
            </div>
          ) : (
            <>
              {/* Editor header */}
              <div className="py-3.5 px-5 border-b border-border bg-surface-2 flex items-center gap-3">
                <div className="w-9 h-9 rounded-md flex items-center justify-center text-[15px] flex-shrink-0" style={{ background: "var(--color-blue-soft)", color: "var(--color-blue)" }}>
                  📝
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-bold text-ink flex items-center gap-2 flex-wrap">
                    {activeNote.patientName} — {activeNote.type}
                    {activeNote.patientId && (
                      <Link href={`/patients/${activeNote.patientId}`} className="text-[11px] font-mono text-brand-dk underline-offset-2 hover:underline">
                        {activeNote.patientId}
                      </Link>
                    )}
                  </div>
                  <div className="text-[11.5px] text-ink-muted">{activeNote.date} · {activeNote.provider}</div>
                </div>
                <Pill intent={activeNote.status === "signed" ? "green" : activeNote.status === "amended" ? "amber" : "muted"} dot>
                  {activeNote.status === "signed" ? "Signed & Locked" : activeNote.status[0].toUpperCase() + activeNote.status.slice(1)}
                </Pill>
              </div>

              {/* Patient / type meta row */}
              <div className="py-2.5 px-5 border-b border-border bg-surface flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <label className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted">Patient</label>
                  <select
                    className="fsel"
                    style={{ padding: "5px 24px 5px 9px", fontSize: 12, minWidth: 0 }}
                    value={activeNote.patientId || ""}
                    onChange={(e) => handlePatientChange(e.target.value)}
                    disabled={isLocked}
                  >
                    <option value="">— Pick patient —</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted">Type</label>
                  <input
                    type="text"
                    value={activeNote.type}
                    onChange={(e) => updateMeta(activeNote.id, { type: e.target.value })}
                    disabled={isLocked}
                    className="bg-surface border border-border rounded text-[12px] py-1 px-2 outline-none focus:border-brand transition-colors disabled:opacity-60"
                    style={{ width: 180 }}
                  />
                </div>
              </div>

              {/* S / O / A / P sections */}
              <div className="flex-1 overflow-y-auto">
                <Section letter="S" label="Subjective" color="var(--color-blue)"   bg="var(--color-blue-soft)"   value={activeNote.s} onChange={(v) => handleSectionChange("s", v)} disabled={isLocked} placeholder="Chief complaint, HPI, ROS, patient-reported symptoms…" />
                <Section letter="O" label="Objective"  color="var(--color-green)"  bg="var(--color-green-soft)"  value={activeNote.o} onChange={(v) => handleSectionChange("o", v)} disabled={isLocked} placeholder="Vitals, exam findings, lab results, diagnostic data…" />
                <Section letter="A" label="Assessment" color="var(--color-amber)"  bg="var(--color-amber-soft)"  value={activeNote.a} onChange={(v) => handleSectionChange("a", v)} disabled={isLocked} placeholder="Diagnoses with ICD-10 codes, clinical reasoning, prognosis…" />
                <Section letter="P" label="Plan"       color="var(--color-violet)" bg="var(--color-violet-soft)" value={activeNote.p} onChange={(v) => handleSectionChange("p", v)} disabled={isLocked} placeholder="Medications, treatments, follow-up, patient education…" />
              </div>

              {/* Footer */}
              <div className="py-3 px-5 bg-surface-2 border-t border-border flex items-center gap-2">
                {!isLocked && (
                  <span className={[
                    "text-[11px] font-semibold transition-opacity",
                    saveFlash ? "text-brand opacity-100" : "text-green opacity-100",
                  ].join(" ")}>
                    {saveFlash ? "💾 Saving…" : "✓ Auto-saved"}
                  </span>
                )}
                {isLocked && activeNote.signedAt && (
                  <span className="text-[11px] text-ink-muted">
                    🔒 Locked · Signed {activeNote.signedAt}
                  </span>
                )}
                <div className="flex-1" />
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setDeleteOpen(true)}
                  disabled={isLocked}
                >
                  🗑 Delete
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => toast("🖨 Print preview opened")}
                >
                  🖨 Print
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => toast("📤 Sent to patient portal")}
                >
                  📤 Send to Portal
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setSignOpen(true)}
                  disabled={isLocked}
                >
                  ✍️ Sign &amp; Lock
                </button>
              </div>
            </>
          )}
        </div>

        {/* RIGHT RAIL — Patient context + templates */}
        <div className="bg-surface border border-border rounded-lg overflow-y-auto px-4 py-3.5 max-[1200px]:hidden">
          {activeNote && activePatient ? (
            <>
              <div className="flex items-center gap-2.5 mb-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0"
                  style={{ background: activePatient.color }}
                >
                  {activePatient.first[0] + activePatient.last[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[13px] text-ink">{activePatient.name}</div>
                  <div className="text-[10.5px] text-ink-muted">{activePatient.id} · Age {activePatient.age}</div>
                </div>
              </div>

              <ContextRow label="Plan"      value={activePatient.plan} />
              <ContextRow label="Dose"      value={activePatient.dose} mono />
              <ContextRow label="Week"      value={String(activePatient.week)} />
              <ContextRow label="Weight"    value={`${activePatient.wt} lbs`} />
              <ContextRow label="BMI"       value={String(activePatient.bmi)} />
              <ContextRow label="BP"        value={activePatient.bp} mono />
              <ContextRow label="Allergies" value={activePatient.allergies} alert={activePatient.allergies !== "NKDA"} last />
            </>
          ) : activeNote ? (
            <div className="text-center py-6">
              <div className="text-[24px] opacity-40 mb-1.5">👤</div>
              <div className="text-[12px] font-bold text-ink mb-1">No patient linked</div>
              <div className="text-[11px] text-ink-muted">Pick a patient above to see their chart context</div>
            </div>
          ) : null}

          <div className="text-[10px] font-bold uppercase tracking-widest text-ink-muted mt-4 mb-2">Templates</div>
          {SOAP_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => handleApplyTemplate(t)}
              disabled={!activeNote || isLocked}
              className="w-full text-left py-2 px-3 mb-1.5 rounded-md bg-surface-2 border border-border text-[11.5px] font-semibold text-ink-2 hover:bg-brand-soft hover:border-brand hover:text-brand-dk transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <span>{t.icon}</span>
              <span className="flex-1">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <ConfirmModal
        open={signOpen}
        onClose={() => setSignOpen(false)}
        onConfirm={handleSign}
        icon="✍️"
        title="Sign & lock this note?"
        message={`Once signed, this note becomes a permanent part of the patient's record and cannot be edited. ${activeNote ? `Signing as ${activeNote.provider}.` : ""}`}
        confirmLabel="Sign & lock"
        destructive={false}
      />
      <ConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        icon="🗑"
        title="Delete this draft?"
        message={activeNote ? `The draft for ${activeNote.patientName} (${activeNote.type}) will be permanently deleted.` : ""}
        confirmLabel="Delete draft"
      />
      <Toast />
    </div>
  );
}

interface SectionProps {
  letter: "S" | "O" | "A" | "P";
  label: string;
  color: string;
  bg: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  placeholder: string;
}

function Section({ letter, label, color, bg, value, onChange, disabled, placeholder }: SectionProps) {
  return (
    <div className="border-b border-border last:border-none py-3.5 px-5">
      <div className="flex items-center gap-2.5 mb-2.5">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center text-[13px] font-extrabold flex-shrink-0"
          style={{ background: bg, color }}
        >
          {letter}
        </div>
        <div className="text-[13px] font-bold text-ink">{label}</div>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full border-[1.5px] border-border rounded-md py-2.5 px-3 font-sans text-[13px] text-ink outline-none resize-y bg-surface-2 leading-relaxed focus:border-brand focus:shadow-[0_0_0_3px_rgba(31,138,112,.15)] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
        style={{ minHeight: 90 }}
      />
    </div>
  );
}

interface FilterChipProps {
  active: boolean;
  count: number;
  onClick: () => void;
  children: ReactNode;
}

function FilterChip({ active, count, onClick, children }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex-1 py-1 px-2 rounded text-[10.5px] font-semibold border transition-colors flex items-center justify-center gap-1",
        active
          ? "bg-brand text-white border-brand"
          : "bg-surface border-border text-ink-2 hover:border-border-2",
      ].join(" ")}
    >
      {children}
      <span className={active ? "opacity-80" : "text-ink-muted"}>{count}</span>
    </button>
  );
}

interface ContextRowProps {
  label: string;
  value: string;
  mono?: boolean;
  alert?: boolean;
  last?: boolean;
}

function ContextRow({ label, value, mono, alert, last }: ContextRowProps) {
  return (
    <div
      className="flex justify-between py-1.5 text-[12px] gap-2"
      style={{ borderBottom: last ? "none" : "1px solid var(--color-border)" }}
    >
      <span className="text-ink-muted">{label}</span>
      <span
        className={`font-semibold text-right truncate ${mono ? "font-mono text-[11px]" : ""}`}
        style={{ color: alert ? "var(--color-red)" : "var(--color-ink)" }}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}
