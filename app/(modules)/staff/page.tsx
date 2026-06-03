"use client";

import { useMemo, useState } from "react";
import type { Key, ReactNode } from "react";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { AddEditDoctorModal } from "@/components/modules/AddEditDoctorModal";
import { LicenseManagerModal } from "@/components/modules/LicenseManagerModal";
import { toast } from "@/lib/hooks/useToast";
import { useDoctors, getLicenseStatus, formatLicenseExp } from "@/lib/hooks/useDoctors";
import { AVATAR_COLOR_POOL } from "@/lib/data/doctors";
import { US_STATES_ALL, DOCTOR_SPECIALTIES } from "@/lib/types";
import type { Doctor, DoctorStateLicense, DoctorTitle, DoctorRole } from "@/lib/types";

type DocFilter = "all" | "active" | "inactive" | "attending" | "np" | "expiring";

const DEMO_NOW = new Date("2026-05-29T00:00:00Z").getTime();
const NINETY_DAYS_MS = 90 * 86_400_000;

export default function DoctorsPage() {
  const doctors      = useDoctors((s) => s.doctors);
  const add          = useDoctors((s) => s.add);
  const update       = useDoctors((s) => s.update);
  const removeDoctor = useDoctors((s) => s.remove);
  const setLicenses  = useDoctors((s) => s.setLicenses);

  const [filter, setFilter]   = useState<DocFilter>("all");
  const [search, setSearch]   = useState("");
  const [editTarget, setEditTarget]     = useState<Doctor | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [licTarget, setLicTarget]       = useState<Doctor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Doctor | null>(null);

  // KPI metrics
  const metrics = useMemo(() => {
    const totalLicenses = doctors.flatMap((d) => d.licenses);
    const activeStates  = new Set<string>();
    doctors.filter((d) => d.active).forEach((d) => d.licenses.forEach((l) => activeStates.add(l.state)));

    const expiring = totalLicenses.filter((l) => {
      const exp = new Date(l.expDate + "T00:00:00Z").getTime();
      return exp > DEMO_NOW && exp < DEMO_NOW + NINETY_DAYS_MS;
    });

    const totalPatients = doctors.reduce((sum, d) => sum + (d.patients || 0), 0);

    return {
      total:      doctors.length,
      active:     doctors.filter((d) => d.active).length,
      states:     activeStates.size,
      licenses:   totalLicenses.length,
      expiring:   expiring.length,
      patients:   totalPatients,
    };
  }, [doctors]);

  // Filter + search
  const filteredDoctors = useMemo(() => {
    let list = doctors;
    if (filter === "active")      list = list.filter((d) => d.active);
    if (filter === "inactive")    list = list.filter((d) => !d.active);
    if (filter === "attending")   list = list.filter((d) => d.role === "Attending Physician" || d.role === "Medical Director");
    if (filter === "np")          list = list.filter((d) => d.title === "NP" || d.title === "PA" || d.role === "Nurse Practitioner" || d.role === "Physician Assistant");
    if (filter === "expiring")    list = list.filter((d) => d.licenses.some((l) => {
      const exp = new Date(l.expDate + "T00:00:00Z").getTime();
      return exp > DEMO_NOW && exp < DEMO_NOW + NINETY_DAYS_MS;
    }));

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((d) =>
        d.first.toLowerCase().includes(q) ||
        d.last.toLowerCase().includes(q) ||
        d.email.toLowerCase().includes(q) ||
        d.npi.toLowerCase().includes(q) ||
        d.specialties.some((s) => s.toLowerCase().includes(q)) ||
        d.licenses.some((l) => l.state.toLowerCase().includes(q))
      );
    }
    return list;
  }, [doctors, filter, search]);

  // Expiring licenses for the right-panel list
  const expiringList = useMemo(() => {
    const items: { doc: Doctor; lic: DoctorStateLicense; days: number }[] = [];
    doctors.forEach((d) => d.licenses.forEach((l) => {
      const exp = new Date(l.expDate + "T00:00:00Z").getTime();
      if (exp > DEMO_NOW && exp < DEMO_NOW + NINETY_DAYS_MS) {
        items.push({ doc: d, lic: l, days: Math.round((exp - DEMO_NOW) / 86_400_000) });
      }
    }));
    return items.sort((a, b) => a.days - b.days);
  }, [doctors]);

  // Team license coverage — which states are covered by ≥1 active doctor
  const coverage = useMemo(() => {
    const covered = new Set<string>();
    const byState = new Map<string, string[]>();   // state → ["Dr. Rivera", ...]
    doctors.filter((d) => d.active).forEach((d) => d.licenses.forEach((l) => {
      const exp = new Date(l.expDate + "T00:00:00Z").getTime();
      // Only count non-expired licenses
      if (exp >= DEMO_NOW) {
        covered.add(l.state);
        if (!byState.has(l.state)) byState.set(l.state, []);
        byState.get(l.state)!.push(`Dr. ${d.last}`);
      }
    }));
    return { covered, byState, pct: Math.round((covered.size / US_STATES_ALL.length) * 100) };
  }, [doctors]);

  // ─── Save handlers ───────────────────────────────────────────────────
  function handleSaveDoctor(input: Omit<Doctor, "id">, editingId?: string) {
    if (editingId) {
      update(editingId, input);
      toast(`✓ Dr. ${input.last} updated`);
    } else {
      add(input);
      toast(`🩺 Dr. ${input.last} added to roster`);
    }
  }

  function handleSaveLicenses(doctorId: string, licenses: DoctorStateLicense[]) {
    setLicenses(doctorId, licenses);
    const doc = doctors.find((d) => d.id === doctorId);
    toast(`✓ Licenses updated for Dr. ${doc?.last ?? "doctor"}`);
  }

  return (
    <div className="px-7 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="text-[22px] font-bold tracking-tight text-ink mb-1">In-House Doctors</div>
          <div className="text-[13px] text-ink-muted">
            Manage your physician team · State licenses · Specialties · Patient assignments
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => toast("📥 Roster import opened")}>📥 Import</button>
          <button className="btn btn-ghost btn-sm" onClick={() => toast("📊 Doctor reports opened")}>📊 Reports</button>
        </div>
      </div>

      {/* 6-card stat strip */}
      <div className="grid grid-cols-6 gap-2.5 mb-4 max-[1100px]:grid-cols-3 max-[600px]:grid-cols-2">
        <StatCard label="Total Doctors"   value={metrics.total}    sub="On platform"             color="var(--color-brand)"  icon="🩺" />
        <StatCard label="Active"          value={metrics.active}   sub="Seeing patients"         color="var(--color-brand)"  icon="✅" />
        <StatCard label="States Licensed" value={metrics.states}   sub="Unique state licenses"   color="var(--color-purple)" icon="🗺" />
        <StatCard label="Total Licenses"  value={metrics.licenses} sub="Across all doctors"      color="var(--color-teal)"   icon="📋" />
        <StatCard label="Expiring (90d)"  value={metrics.expiring} sub="Need renewal soon"       color="var(--color-amber)"  icon="⚠" />
        <StatCard label="Patients (total)" value={metrics.patients} sub="Assigned across team"   color="var(--color-pink)"   icon="👥" />
      </div>

      {/* 2-column shell */}
      <div className="grid grid-cols-[1fr_380px] gap-3.5 max-[1100px]:grid-cols-1">
        {/* LEFT: Roster */}
        <div>
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            {/* Card header */}
            <div className="py-3.5 px-[18px] border-b border-border flex items-center gap-3">
              <div className="w-8 h-8 rounded-md flex items-center justify-center text-[14px] flex-shrink-0 border border-border bg-brand-soft" style={{ color: "var(--color-brand)" }}>
                🩺
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-bold text-ink">Physician Roster</div>
                <div className="text-[11.5px] text-ink-muted">Click a doctor to edit · Manage state licenses inline</div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => setAddModalOpen(true)}>+ Add Doctor</button>
            </div>

            {/* Filter bar */}
            <div className="flex items-center gap-1.5 py-2.5 px-[18px] border-b border-border bg-surface-2 flex-wrap">
              <FilterChip current={filter} value="all"        onClick={setFilter}>All</FilterChip>
              <FilterChip current={filter} value="active"     onClick={setFilter}>Active</FilterChip>
              <FilterChip current={filter} value="inactive"   onClick={setFilter}>Inactive</FilterChip>
              <FilterChip current={filter} value="attending"  onClick={setFilter}>Attending</FilterChip>
              <FilterChip current={filter} value="np"         onClick={setFilter}>NP / PA</FilterChip>
              <FilterChip current={filter} value="expiring"   onClick={setFilter} highlight={metrics.expiring > 0}>
                Expiring Licenses
                {metrics.expiring > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-[15px] px-1 rounded-pill bg-amber text-white text-[9.5px] font-bold">
                    {metrics.expiring}
                  </span>
                )}
              </FilterChip>
              <div className="flex items-center gap-1.5 bg-surface border border-border rounded-pill py-1 px-3 ml-auto min-w-[220px] focus-within:border-brand focus-within:shadow-[0_0_0_3px_rgba(31,138,112,.15)]">
                <span className="text-ink-muted text-[13px]">🔍</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, NPI, specialty, state…"
                  className="flex-1 bg-transparent border-none outline-none text-[12px] text-ink placeholder:text-ink-muted-2"
                />
              </div>
            </div>

            {/* Doctor cards */}
            <div className="p-[18px]">
              {filteredDoctors.length === 0 ? (
                <div className="py-10 text-center text-ink-muted">
                  <div className="text-[36px] opacity-40 mb-2">🩺</div>
                  <div className="text-[13px] font-bold text-ink mb-0.5">No doctors match</div>
                  <div className="text-[11.5px]">Try a different filter or search term</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredDoctors.map((d, i) => (
                    <DoctorCard
                      key={d.id}
                      doctor={d}
                      delay={i * 40}
                      onEdit={() => setEditTarget(d)}
                      onLicenses={() => setLicTarget(d)}
                      onDelete={() => setDeleteTarget(d)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Side panels */}
        <div className="space-y-3.5">
          <QuickAddCard onAdd={(input) => {
            add(input);
            toast(`🩺 Dr. ${input.last} added to roster`);
          }} />

          {/* Team coverage */}
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="py-3 px-4 border-b border-border flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md flex items-center justify-center text-[13px] flex-shrink-0 border border-border bg-purple-soft" style={{ color: "var(--color-purple)" }}>
                🗺
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-bold text-ink">Team License Coverage</div>
                <div className="text-[10.5px] text-ink-muted">States with ≥1 active doctor</div>
              </div>
            </div>
            <div className="p-3.5">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="text-[13px] font-bold text-ink whitespace-nowrap">
                  {coverage.covered.size}/{US_STATES_ALL.length} states
                </div>
                <div className="flex-1 h-2 bg-surface-3 rounded-pill overflow-hidden">
                  <div className="h-full bg-brand rounded-pill transition-all" style={{ width: `${coverage.pct}%` }} />
                </div>
                <div className="text-[11.5px] font-bold text-brand-dk">{coverage.pct}%</div>
              </div>

              <div
                className="grid gap-1"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(38px, 1fr))" }}
              >
                {US_STATES_ALL.map((s) => {
                  const isCovered = coverage.covered.has(s);
                  const tip = isCovered
                    ? `Licensed: ${coverage.byState.get(s)?.join(", ")}`
                    : `No active doctor licensed in ${s}`;
                  return (
                    <div
                      key={s}
                      title={tip}
                      className={[
                        "py-1 px-1 rounded text-center font-mono font-bold text-[10px] border",
                        isCovered
                          ? "bg-brand-soft text-brand-dk border-brand-soft"
                          : "bg-surface-3 text-ink-muted-2 border-border",
                      ].join(" ")}
                    >
                      {s}
                    </div>
                  );
                })}
              </div>
              <div className="mt-2.5 text-[10.5px] text-ink-muted flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-brand-soft border border-brand-soft inline-block flex-shrink-0" />
                <span>Covered by ≥1 active doctor with unexpired license</span>
              </div>
            </div>
          </div>

          {/* Expiring */}
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="py-3 px-4 border-b border-border flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md flex items-center justify-center text-[13px] flex-shrink-0 border border-border bg-amber-soft" style={{ color: "var(--color-amber)" }}>
                ⚠
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-bold text-ink">Expiring Licenses</div>
                <div className="text-[10.5px] text-ink-muted">Renewal required within 90 days</div>
              </div>
            </div>
            <div className="p-3.5">
              {expiringList.length === 0 ? (
                <div className="py-5 text-center text-ink-muted">
                  <div className="text-[20px] mb-1.5">✓</div>
                  <div className="text-[12px] font-bold text-ink">All licenses current</div>
                  <div className="text-[10.5px] mt-0.5">No renewals due in 90 days</div>
                </div>
              ) : (
                <div>
                  {expiringList.map((it, i) => {
                    const initials = (it.doc.first[0] + it.doc.last[0]).toUpperCase();
                    const urgent = it.days <= 30;
                    return (
                      <button
                        key={`${it.doc.id}-${it.lic.state}`}
                        onClick={() => setLicTarget(it.doc)}
                        className={`w-full text-left flex items-center gap-2.5 py-2 hover:bg-surface-2 transition-colors -mx-1.5 px-1.5 rounded-md ${i < expiringList.length - 1 ? "border-b border-border" : ""}`}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                          style={{ background: it.doc.color }}
                        >
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12.5px] font-semibold text-ink">
                            Dr. {it.doc.last} · <span className="font-mono text-purple">{it.lic.state}</span>
                          </div>
                          <div className="text-[10.5px] text-ink-muted font-mono mt-px">
                            {it.lic.number || "—"} · Exp {formatLicenseExp(it.lic.expDate)}
                          </div>
                        </div>
                        <Pill intent={urgent ? "red" : "amber"}>{it.days}d</Pill>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddEditDoctorModal
        open={addModalOpen || !!editTarget}
        initial={editTarget}
        onClose={() => { setAddModalOpen(false); setEditTarget(null); }}
        onSave={handleSaveDoctor}
      />
      <LicenseManagerModal
        doctor={licTarget}
        onClose={() => setLicTarget(null)}
        onSave={handleSaveLicenses}
      />
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            removeDoctor(deleteTarget.id);
            toast(`🗑 Dr. ${deleteTarget.last} removed from roster`);
          }
        }}
        icon="🗑"
        title="Remove Doctor?"
        message={deleteTarget ? `Dr. ${deleteTarget.first} ${deleteTarget.last} will be removed from the roster. ${deleteTarget.patients > 0 ? `Their ${deleteTarget.patients} active patients will need reassignment.` : ""}` : ""}
        confirmLabel="Remove Doctor"
      />
      <Toast />
    </div>
  );
}

// ─── Stat card ─────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon }: { label: string; value: number; sub: string; color: string; icon: string }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-3.5 relative hover:shadow-sm hover:border-border-2 transition-all">
      <div className="absolute top-3 right-3.5 text-[16px] opacity-40">{icon}</div>
      <div className="text-[10.5px] font-medium text-ink-muted mb-1.5 pr-5">{label}</div>
      <div className="text-[22px] font-bold leading-none mb-1" style={{ color }}>{value.toLocaleString()}</div>
      <div className="text-[10px] text-ink-muted font-medium">{sub}</div>
    </div>
  );
}

// ─── Filter chip ────────────────────────────────────────────────────────
function FilterChip<T extends string>({ current, value, onClick, children, highlight }: { current: T; value: T; onClick: (v: T) => void; children: ReactNode; highlight?: boolean }) {
  const active = current === value;
  return (
    <button
      onClick={() => onClick(value)}
      className={[
        "py-1.5 px-3 rounded-pill text-[11.5px] font-semibold border transition-colors flex items-center",
        active
          ? "bg-brand text-white border-brand"
          : highlight
            ? "bg-amber-soft border-amber text-amber hover:bg-amber hover:text-white"
            : "bg-surface border-border text-ink-2 hover:border-border-2",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// ─── Doctor card ────────────────────────────────────────────────────────
interface DoctorCardProps {
  key?: Key;
  doctor: Doctor;
  delay: number;
  onEdit: () => void;
  onLicenses: () => void;
  onDelete: () => void;
}

function DoctorCard({ doctor: d, delay, onEdit, onLicenses, onDelete }: DoctorCardProps) {
  const initials = (d.first[0] + d.last[0]).toUpperCase();
  return (
    <div
      className={`bg-surface border rounded-lg p-3.5 hover:shadow-md transition-shadow animate-fadeUp ${d.active ? "border-border" : "border-border bg-surface-2"}`}
      style={{
        animationDelay: `${delay}ms`,
        opacity: d.active ? 1 : 0.75,
      }}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-[14px] font-bold text-white flex-shrink-0"
          style={{ background: d.color }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-bold text-ink leading-tight">
            Dr. {d.first} {d.last}, {d.title}
          </div>
          <div className="text-[11.5px] text-ink-muted mt-0.5">
            {d.role} · {d.specialties.slice(0, 3).join(" · ")}
          </div>
          <div className="flex gap-1.5 flex-wrap mt-1.5">
            <Pill intent={d.active ? "green" : "muted"} dot>{d.active ? "Active" : "Inactive"}</Pill>
            {d.epcs        && <Pill intent="purple">EPCS</Pill>}
            {d.surescripts && <Pill intent="blue">📡 Surescripts</Pill>}
            {d.onCall      && <Pill intent="amber">📞 On-Call</Pill>}
            {!d.acceptingNew && <Pill intent="muted">No new patients</Pill>}
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <IconBtn title="Manage Licenses" onClick={onLicenses}>📋</IconBtn>
          <IconBtn title="Edit"             onClick={onEdit}>✏</IconBtn>
          <IconBtn title="Remove"           onClick={onDelete} danger>🗑</IconBtn>
        </div>
      </div>

      {/* Body — NPI / Patients / Licenses */}
      <div className="grid grid-cols-3 gap-2 py-2.5 px-3 bg-surface-2 border border-border rounded-md mb-3">
        <div>
          <div className="text-[9.5px] font-bold uppercase tracking-widest text-ink-muted">NPI</div>
          <div className="font-mono text-[11.5px] mt-0.5 text-ink">{d.npi || "—"}</div>
        </div>
        <div>
          <div className="text-[9.5px] font-bold uppercase tracking-widest text-ink-muted">Patients</div>
          <div className="text-[12px] font-bold mt-0.5 text-brand-dk">{d.patients} / {d.maxPatients ?? "∞"}</div>
        </div>
        <div>
          <div className="text-[9.5px] font-bold uppercase tracking-widest text-ink-muted">Licenses</div>
          <div className="text-[12px] font-bold mt-0.5 text-purple">{d.licenses.length} states</div>
        </div>
      </div>

      {/* License tags */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted">
            State Licenses ({d.licenses.length})
          </div>
          <button
            className="text-[10.5px] text-brand-dk font-semibold hover:underline"
            onClick={onLicenses}
          >
            + Manage
          </button>
        </div>
        {d.licenses.length === 0 ? (
          <div className="text-[11px] italic text-ink-muted py-1">No state licenses yet.</div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {d.licenses.map((l) => {
              const s = getLicenseStatus(l);
              const intent = s.pillIntent;
              const intentClasses =
                intent === "red"   ? "bg-red-soft text-red border-red-soft"
              : intent === "amber" ? "bg-amber-soft text-amber border-amber-soft"
              : intent === "green" ? "bg-green-soft text-green border-green-soft"
                                   : "bg-surface-2 text-ink-muted border-border";
              return (
                <div
                  key={l.state}
                  title={`License ${l.number || "—"} · Exp ${l.expDate || "—"}`}
                  className={`flex items-center gap-1.5 py-1 px-2 rounded text-[10px] font-mono border ${intentClasses}`}
                >
                  <span className="font-bold">{l.state}</span>
                  {l.number && <span className="opacity-75 text-[9.5px]">{l.number}</span>}
                  <span className="opacity-90">{s.icon} {formatLicenseExp(l.expDate)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function IconBtn({ title, onClick, children, danger }: { title: string; onClick: () => void; children: ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={[
        "w-8 h-8 rounded-md flex items-center justify-center text-[14px] border transition-colors",
        danger
          ? "border-border text-ink-muted hover:bg-red-soft hover:border-red hover:text-red"
          : "border-border text-ink-2 hover:bg-brand-soft hover:border-brand hover:text-brand-dk",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// ─── Quick Add card (right column) ──────────────────────────────────────
function QuickAddCard({ onAdd }: { onAdd: (input: Omit<Doctor, "id">) => void }) {
  const [first, setFirst]           = useState("");
  const [last, setLast]             = useState("");
  const [title, setTitle]           = useState<DoctorTitle>("MD");
  const [role, setRole]             = useState<DoctorRole>("Attending Physician");
  const [email, setEmail]           = useState("");
  const [npi, setNpi]               = useState("");
  const [specialties, setSpecialties] = useState<Set<string>>(new Set(["Weight Management"]));
  const [selectedStates, setSelectedStates] = useState<Set<string>>(new Set());
  const [active, setActive]         = useState(true);
  const [epcs, setEpcs]             = useState(false);
  const [stateSearch, setStateSearch] = useState("");

  function toggleSpec(s: string) {
    setSpecialties((p) => { const n = new Set(p); if (n.has(s)) n.delete(s); else n.add(s); return n; });
  }
  function toggleState(s: string) {
    setSelectedStates((p) => { const n = new Set(p); if (n.has(s)) n.delete(s); else n.add(s); return n; });
  }

  function handleAdd() {
    if (!first.trim() || !last.trim() || !email.trim()) {
      toast("⚠ First name, last name, and email are required");
      return;
    }
    const licenses: DoctorStateLicense[] = Array.from(selectedStates).map((s): DoctorStateLicense => ({ state: s as string, number: "", expDate: "" }));
    const color = AVATAR_COLOR_POOL[Math.floor(Math.random() * AVATAR_COLOR_POOL.length)];
    onAdd({
      first: first.trim(),
      last: last.trim(),
      title, role,
      email: email.trim(),
      phone: "",
      npi: npi.trim(),
      yearsExperience: 0,
      specialties: Array.from(specialties),
      active, epcs, surescripts: true, onCall: false, acceptingNew: true,
      patients: 0,
      color,
      licenses,
    });
    // Reset
    setFirst(""); setLast(""); setEmail(""); setNpi("");
    setSpecialties(new Set(["Weight Management"]));
    setSelectedStates(new Set());
    setActive(true); setEpcs(false);
    setStateSearch("");
  }

  const filteredStates = useMemo(() => {
    const q = stateSearch.trim().toUpperCase();
    if (!q) return US_STATES_ALL;
    return US_STATES_ALL.filter((s) => s.startsWith(q));
  }, [stateSearch]);

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="py-3 px-4 border-b border-border flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md flex items-center justify-center text-[13px] flex-shrink-0 border border-border bg-brand-soft" style={{ color: "var(--color-brand)" }}>
          ⚡
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-bold text-ink">Quick Add Doctor</div>
          <div className="text-[10.5px] text-ink-muted">Essential info + states</div>
        </div>
      </div>

      <div className="p-3.5 space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="fl">First<span className="text-red ml-0.5">*</span></label>
            <input className="fi" placeholder="Maria" value={first} onChange={(e) => setFirst(e.target.value)} />
          </div>
          <div>
            <label className="fl">Last<span className="text-red ml-0.5">*</span></label>
            <input className="fi" placeholder="Garcia" value={last} onChange={(e) => setLast(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="fl">Title</label>
            <select className="fsel" value={title} onChange={(e) => setTitle(e.target.value as DoctorTitle)}>
              <option>MD</option><option>DO</option><option>NP</option><option>PA</option><option>PharmD</option>
            </select>
          </div>
          <div>
            <label className="fl">Role</label>
            <select className="fsel" value={role} onChange={(e) => setRole(e.target.value as DoctorRole)}>
              <option>Attending Physician</option>
              <option>Associate Physician</option>
              <option>Nurse Practitioner</option>
              <option>Physician Assistant</option>
              <option>Medical Director</option>
            </select>
          </div>
        </div>

        <div>
          <label className="fl">Email<span className="text-red ml-0.5">*</span></label>
          <input type="email" className="fi" placeholder="dr@dripvitals.health" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="fl">NPI</label>
          <input className="fi font-mono" placeholder="10-digit NPI" value={npi} onChange={(e) => setNpi(e.target.value)} />
        </div>

        <div>
          <label className="fl">Specialties</label>
          <div className="flex flex-wrap gap-1">
            {DOCTOR_SPECIALTIES.slice(0, 6).map((s) => {
              const sel = specialties.has(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSpec(s)}
                  className={[
                    "py-1 px-2 rounded-pill text-[10.5px] font-semibold border transition-colors",
                    sel
                      ? "bg-brand-soft border-brand text-brand-dk"
                      : "bg-surface border-border text-ink-2 hover:border-border-2",
                  ].join(" ")}
                >
                  {sel && "✓ "}{s}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="fl">State Licenses</label>
          <input
            className="fi mb-1.5"
            placeholder="Filter (e.g. FL)…"
            value={stateSearch}
            onChange={(e) => setStateSearch(e.target.value)}
          />
          <div
            className="grid gap-1 max-h-[120px] overflow-y-auto p-1 bg-surface-2 border border-border rounded-md"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(40px, 1fr))" }}
          >
            {filteredStates.map((s) => {
              const sel = selectedStates.has(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleState(s)}
                  className={[
                    "py-1 px-1 rounded text-[10px] font-mono font-bold transition-colors border text-center",
                    sel
                      ? "bg-brand text-white border-brand"
                      : "bg-surface border-border text-ink-2 hover:border-brand hover:text-brand-dk",
                  ].join(" ")}
                >
                  {s}
                </button>
              );
            })}
          </div>
          {selectedStates.size > 0 && (
            <div className="text-[10px] text-ink-muted mt-1.5">
              {selectedStates.size} state{selectedStates.size === 1 ? "" : "s"} selected · License #s entered later
            </div>
          )}
        </div>

        <div className="bg-surface-2 border border-border rounded-md py-1 px-3 mt-1">
          <MiniToggle label="Active"        sub="Accepting patients"     checked={active} onChange={setActive} />
          <MiniToggle label="EPCS Certified" sub="Can e-Rx controlled substances" checked={epcs} onChange={setEpcs} isLast />
        </div>

        <button className="btn btn-primary w-full justify-center" style={{ padding: "9px 16px" }} onClick={handleAdd}>
          + Add to Roster
        </button>
      </div>
    </div>
  );
}

function MiniToggle({ label, sub, checked, onChange, isLast }: { label: string; sub: string; checked: boolean; onChange: (v: boolean) => void; isLast?: boolean }) {
  return (
    <label className={`flex items-center justify-between gap-2 py-2 cursor-pointer ${isLast ? "" : "border-b border-border"}`}>
      <div className="flex-1 min-w-0">
        <div className="text-[11.5px] font-bold text-ink">{label}</div>
        <div className="text-[10px] text-ink-muted leading-snug">{sub}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          "relative w-8 h-[18px] rounded-pill border transition-colors flex-shrink-0",
          checked ? "bg-brand border-brand" : "bg-surface-3 border-border-2",
        ].join(" ")}
      >
        <span
          className="absolute top-[1px] left-[1px] w-[13px] h-[13px] rounded-full bg-white shadow-sm transition-transform"
          style={{ transform: checked ? "translateX(14px)" : "translateX(0)" }}
        />
      </button>
    </label>
  );
}
