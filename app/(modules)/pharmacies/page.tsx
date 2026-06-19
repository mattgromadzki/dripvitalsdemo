"use client";

import { useMemo, useState } from "react";
import type { Key, ReactNode } from "react";
import { Toast } from "@/components/ui/Toast";
import { toast } from "@/lib/hooks/useToast";
import { usePharmacies, resetPharmaciesToDefaults } from "@/lib/hooks/usePharmacies";
import type { Pharmacy } from "@/lib/types";

const ALL_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
] as const;

type FilterKey = "all" | "active" | "inactive" | "compounding" | "retail" | "mail";
type PharmaTypeStr = "Compounding" | "Retail" | "Mail Order" | "Specialty" | "Hospital" | "LTC";

// Map type display string ↔ stored lowercase type
function typeToStored(t: PharmaTypeStr): Pharmacy["type"] {
  if (t === "Mail Order") return "mail-order";
  if (t === "Retail")     return "retail";
  if (t === "Specialty")  return "specialty";
  return "compounding"; // Compounding / Hospital / LTC all map here for now
}
function typeToDisplay(t: Pharmacy["type"]): PharmaTypeStr {
  if (t === "mail-order") return "Mail Order";
  if (t === "retail")     return "Retail";
  if (t === "specialty")  return "Specialty";
  return "Compounding";
}

// Accent color per pharmacy (matches bask `pharmAccent` mapping)
function accentFor(p: Pharmacy): { color: string; soft: string } {
  if (p.primary)              return { color: "var(--color-brand)",  soft: "var(--color-brand-soft)" };
  if (p.compound)             return { color: "var(--color-purple)", soft: "var(--color-purple-soft)" };
  if (p.type === "mail-order") return { color: "var(--color-coral)",  soft: "var(--color-coral-soft)" };
  if (p.type === "retail")    return { color: "var(--color-blue)",   soft: "var(--color-blue-soft)" };
  if (p.type === "specialty") return { color: "var(--color-teal)",   soft: "var(--color-teal-soft)" };
  return { color: "var(--color-ink-2)", soft: "var(--color-surface-3)" };
}

export default function PartnerPharmaciesPage() {
  const pharmacies   = usePharmacies((s) => s.pharmacies);
  const addPharm     = usePharmacies((s) => s.add);
  const updatePharm  = usePharmacies((s) => s.update);
  const removePharm  = usePharmacies((s) => s.remove);

  const [filter, setFilter]   = useState<FilterKey>("all");
  const [search, setSearch]   = useState("");
  const [editId, setEditId]   = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ── Filtering ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return pharmacies.filter((p) => {
      const isActive = p.active !== false;
      if (filter === "active"      && !isActive)               return false;
      if (filter === "inactive"    && isActive)                return false;
      if (filter === "compounding" && !p.compound)             return false;
      if (filter === "retail"      && p.type !== "retail")     return false;
      if (filter === "mail"        && p.type !== "mail-order") return false;
      if (q) {
        const hay = `${p.name} ${p.dba || ""} ${p.city || ""} ${p.state || ""} ${p.contactEmail || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [pharmacies, filter, search]);

  // ── Stats ───────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = pharmacies.length;
    const active = pharmacies.filter((p) => p.active !== false).length;
    const stateSet = new Set<string>();
    pharmacies.filter((p) => p.active !== false).forEach((p) => (p.statesList || []).forEach((s) => stateSet.add(s)));
    const compound = pharmacies.filter((p) => p.compound).length;
    const orders30d = pharmacies.reduce((sum, p) => sum + (p.orders30d || 0), 0);
    return { total, active, states: stateSet.size, compound, orders30d };
  }, [pharmacies]);

  // ── Coverage map ────────────────────────────────────────────────────
  const coverage = useMemo(() => {
    const covered = new Map<string, string[]>();
    pharmacies.filter((p) => p.active !== false).forEach((p) => (p.statesList || []).forEach((s) => {
      if (!covered.has(s)) covered.set(s, []);
      covered.get(s)!.push(p.name);
    }));
    const total = ALL_STATES.length;
    const coveredCount = covered.size;
    const pct = Math.round((coveredCount / total) * 100);
    return { covered, total, coveredCount, pct };
  }, [pharmacies]);

  function openAdd() { setEditId(null); setAddOpen(true); }
  function openEdit(id: string) { setEditId(id); setAddOpen(true); }
  function confirmDelete() {
    if (!deleteId) return;
    const p = pharmacies.find((x) => x.id === deleteId);
    removePharm(deleteId);
    setDeleteId(null);
    if (p) toast(`🗑 ${p.name} removed`);
  }

  return (
    <>
      {/* ── PAGE HEADER ───────────────────────────────────────────── */}
      <div className="px-7 py-6 max-w-[1480px] mx-auto">
        <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
          <div>
            <div className="text-[22px] font-bold tracking-tight text-ink mb-1">Partner Pharmacies</div>
            <div className="text-[13px] text-ink-muted">Add and manage pharmacy partners · Assign medications · Configure routing by state</div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => toast("📥 CSV import opened")}>📥 Import CSV</button>
            <button className="btn btn-ghost btn-sm" onClick={() => toast("📊 Pharmacy reports opened")}>📊 Reports</button>
            <button className="btn btn-ghost btn-sm" style={{ color: "var(--color-amber)" }} onClick={async () => { await resetPharmaciesToDefaults(); toast("↺ Pharmacies reset to defaults"); }}>↺ Reset to defaults</button>
            <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Pharmacy</button>
          </div>
        </div>

        {/* ── STAT STRIP ─────────────────────────────────────────── */}
        <div className="grid grid-cols-5 max-[1100px]:grid-cols-2 gap-3 mb-4">
          <StatCard icon="🏥" label="Total Pharmacies" value={stats.total}        sub="In network"                 valueColor="var(--color-brand)" />
          <StatCard icon="✅" label="Active"           value={stats.active}       sub="Currently routing orders"   valueColor="var(--color-brand)" />
          <StatCard icon="🗺️" label="States Covered"   value={stats.states}       sub="Unique licensed states"     valueColor="var(--color-purple)" />
          <StatCard icon="🧪" label="Compounding"      value={stats.compound}     sub="Can compound GLP-1 meds"    valueColor="var(--color-coral)" />
          <StatCard icon="📦" label="Orders (30d)"     value={stats.orders30d.toLocaleString()} sub="Across all pharmacies" valueColor="var(--color-teal)" />
        </div>

        {/* ── MAIN GRID ──────────────────────────────────────────── */}
        <div className="grid grid-cols-[1fr_380px] max-[1100px]:grid-cols-1 gap-3.5">
          {/* LEFT — pharmacy list */}
          <div>
            <div className="bg-surface border border-border rounded-lg shadow-xs overflow-hidden">
              {/* Card head */}
              <div className="py-3.5 px-4 border-b border-border flex items-center gap-3">
                <div className="w-[34px] h-[34px] rounded-[10px] bg-brand-soft text-brand flex items-center justify-center text-[15px] flex-shrink-0">🏥</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-bold text-ink tracking-tight">Pharmacy Network</div>
                  <div className="text-[11.5px] text-ink-muted">All partner pharmacies · Click to edit</div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Pharmacy</button>
              </div>

              {/* Filter bar */}
              <div className="py-3 px-4 border-b border-border bg-surface-2 flex items-center gap-1.5 flex-wrap">
                {(["all","active","inactive","compounding","retail","mail"] as FilterKey[]).map((k) => (
                  <FilterChip key={k} active={filter === k} onClick={() => setFilter(k)}>
                    {k === "all" ? "All" : k === "mail" ? "Mail Order" : k.charAt(0).toUpperCase() + k.slice(1)}
                  </FilterChip>
                ))}
                <div className="flex-1" />
                <div className="flex items-center gap-1.5 bg-surface border border-border rounded-pill px-3 py-1 min-w-[220px] focus-within:border-brand focus-within:shadow-[0_0_0_3px_var(--color-brand-glow)]">
                  <span className="text-ink-muted text-[13px]">🔍</span>
                  <input
                    type="text"
                    className="flex-1 border-none outline-none font-sans text-[12px] bg-transparent text-ink placeholder:text-ink-muted"
                    placeholder="Search pharmacies…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* List */}
              <div className="p-4">
                {filtered.length === 0 ? (
                  <div className="text-center py-10 px-6 text-ink-muted">
                    <div className="text-[36px] opacity-40 mb-2">🏥</div>
                    <div className="text-[13px] font-bold text-ink">No pharmacies match</div>
                    <div className="text-[11.5px] mt-1">Try a different filter or search term</div>
                  </div>
                ) : (
                  filtered.map((p) => (
                    <PharmacyCard
                      key={p.id}
                      p={p}
                      onEdit={() => openEdit(p.id)}
                      onDelete={() => setDeleteId(p.id)}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* RIGHT — quick add + coverage */}
          <div className="space-y-3.5">
            <QuickAddCard
              onAdd={(input) => {
                addPharm(input);
                toast(`✓ ${input.name} added to network`);
              }}
            />
            <CoverageCard coverage={coverage} />
          </div>
        </div>
      </div>

      {/* Add / Edit modal */}
      {addOpen && (
        <AddEditModal
          editing={editId ? pharmacies.find((p) => p.id === editId) || null : null}
          onClose={() => setAddOpen(false)}
          onSave={(input) => {
            if (editId) {
              if (input.primary) {
                // Ensure only one primary at a time
                pharmacies.forEach((p) => {
                  if (p.id !== editId && p.primary) updatePharm(p.id, { primary: false });
                });
              }
              updatePharm(editId, input);
              toast(`✏ ${input.name} updated`);
            } else {
              if (input.primary) {
                pharmacies.forEach((p) => p.primary && updatePharm(p.id, { primary: false }));
              }
              addPharm(input);
              toast(`✓ ${input.name} added to network`);
            }
            setAddOpen(false);
          }}
        />
      )}

      {/* Delete confirm modal */}
      {deleteId && (
        <ConfirmDeleteModal
          name={pharmacies.find((p) => p.id === deleteId)?.name || ""}
          onCancel={() => setDeleteId(null)}
          onConfirm={confirmDelete}
        />
      )}

      <Toast />
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────
// STAT CARD
// ────────────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, valueColor }: {
  key?: Key;
  icon: string;
  label: string;
  value: string | number;
  sub: string;
  valueColor: string;
}) {
  return (
    <div className="relative bg-surface border border-border rounded-lg p-4 shadow-xs hover:shadow-sm hover:border-border-2 transition-all">
      <span className="absolute top-3 right-4 text-[16px] opacity-45">{icon}</span>
      <div className="text-[11px] text-ink-muted font-medium mb-2">{label}</div>
      <div className="text-[24px] font-bold tracking-tight leading-tight" style={{ color: valueColor }}>{value}</div>
      <div className="text-[10.5px] text-ink-muted font-medium mt-0.5">{sub}</div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// FILTER CHIP
// ────────────────────────────────────────────────────────────────────────
function FilterChip({ active, onClick, children }: { key?: Key; active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        "px-3 py-1 rounded-pill text-[11.5px] font-semibold border transition-colors",
        active
          ? "bg-brand text-white border-brand"
          : "bg-surface text-ink-2 border-border hover:border-border-2",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────
// PHARMACY CARD
// ────────────────────────────────────────────────────────────────────────
function PharmacyCard({ p, onEdit, onDelete }: { key?: Key; p: Pharmacy; onEdit: () => void; onDelete: () => void }) {
  const accent = accentFor(p);
  const states = p.statesList || [];
  const visibleStates = states.slice(0, 18);
  const extra = states.length - 18;
  const isActive = p.active !== false;

  return (
    <div
      className={`mb-2.5 bg-surface border border-border rounded-md overflow-hidden transition-all hover:border-border-2 hover:shadow-sm pharm-card-fadein ${
        isActive ? "" : "opacity-65"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 py-3 px-4 border-b border-border">
        <div
          className="w-[42px] h-[42px] rounded-[11px] flex items-center justify-center text-[19px] flex-shrink-0 border border-transparent"
          style={{ background: accent.soft, color: accent.color }}
        >
          {p.icon || "🏥"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-bold tracking-tight text-ink flex items-center gap-1.5 flex-wrap">
            {p.name}
            {p.primary && <Pill intent="brand">★ Primary</Pill>}
          </div>
          <div className="text-[11.5px] text-ink-muted">
            {typeToDisplay(p.type)} · {p.city || "—"}{p.state ? `, ${p.state}` : ""}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {isActive ? <Pill intent="green" dot>Active</Pill> : <Pill intent="muted" dot>Inactive</Pill>}
          {p.compound    && <Pill intent="purple">🧪 Compounding</Pill>}
          {p.ship        && <Pill intent="teal">📦 Ship-to-Home</Pill>}
          {p.surescripts && <Pill intent="blue">📡 Surescripts</Pill>}
          {p.epcs        && <Pill intent="amber">🔒 EPCS</Pill>}
        </div>
        <div className="flex gap-1 ml-2.5">
          <PhAct title="Edit" onClick={onEdit}>✏</PhAct>
          <PhAct title="Remove" onClick={onDelete} danger>🗑</PhAct>
        </div>
      </div>
      {/* Body */}
      <div className="grid grid-cols-3 max-[700px]:grid-cols-1 gap-3.5 py-3.5 px-4 border-b border-border">
        <BodyField label="NPI">
          <span className="font-mono text-[11.5px]">{p.npi || "—"}</span>
        </BodyField>
        <BodyField label="Contact">{p.contactEmail || "—"}</BodyField>
        <BodyField label="Orders (30d)">
          <span style={{ color: accent.color, fontWeight: 700 }}>{p.orders30d ?? 0}</span>
        </BodyField>
      </div>
      {/* Footer */}
      <div className="py-2.5 px-4 bg-surface-2 flex items-start gap-2 flex-wrap">
        <div className="text-[10px] text-ink-muted font-bold uppercase tracking-[0.8px] flex-shrink-0 pt-0.5">
          Licensed in {states.length}:
        </div>
        <div className="flex flex-wrap gap-1 flex-1">
          {visibleStates.map((s, i) => (
            <span key={`${s}-${i}`} className="state-tag">{s}</span>
          ))}
          {extra > 0 && <Pill intent="muted">+{extra} more</Pill>}
        </div>
      </div>
    </div>
  );
}
function BodyField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.85px] text-ink-muted font-semibold mb-0.5">{label}</div>
      <div className="text-[12.5px] text-ink font-medium">{children}</div>
    </div>
  );
}
function PhAct({ children, onClick, title, danger }: { children: ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={[
        "w-[30px] h-[30px] rounded-md bg-surface-2 border border-border flex items-center justify-center text-[13px] cursor-pointer text-ink-2 transition-colors",
        danger ? "hover:bg-red-soft hover:border-red-soft hover:text-red" : "hover:bg-brand-soft hover:border-brand hover:text-brand-dk",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────
// PILL (local — matches bask pill exactly)
// ────────────────────────────────────────────────────────────────────────
function Pill({ intent, children, dot }: {
  intent: "brand" | "green" | "blue" | "amber" | "red" | "purple" | "teal" | "coral" | "muted";
  children: ReactNode;
  dot?: boolean;
}) {
  const bg = {
    brand: "var(--color-brand-soft)",  green: "var(--color-green-soft)", blue: "var(--color-blue-soft)",
    amber: "var(--color-amber-soft)",  red: "var(--color-red-soft)",     purple: "var(--color-purple-soft)",
    teal: "var(--color-teal-soft)",    coral: "var(--color-coral-soft)", muted: "var(--color-surface-3)",
  }[intent];
  const color = {
    brand: "var(--color-brand)",  green: "var(--color-green)",  blue: "var(--color-blue)",
    amber: "var(--color-amber)",  red: "var(--color-red)",      purple: "var(--color-purple)",
    teal: "var(--color-teal)",    coral: "var(--color-coral)",  muted: "var(--color-ink-muted)",
  }[intent];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-[10px] font-semibold whitespace-nowrap"
      style={{ background: bg, color }}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: "currentColor" }} />}
      {children}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────
// QUICK ADD CARD (right column)
// ────────────────────────────────────────────────────────────────────────
function QuickAddCard({ onAdd }: { onAdd: (input: Omit<Pharmacy, "id">) => void }) {
  const [name, setName]     = useState("");
  const [type, setType]     = useState<PharmaTypeStr>("Compounding");
  const [npi, setNpi]       = useState("");
  const [ncpdp, setNcpdp]   = useState("");
  const [email, setEmail]   = useState("");
  const [phone, setPhone]   = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [compound, setCompound] = useState(true);
  const [ship, setShip]         = useState(true);
  const [active, setActive]     = useState(true);
  const [stateSearch, setStateSearch] = useState("");

  function toggle(s: string) {
    const next = new Set(picked);
    if (next.has(s)) next.delete(s); else next.add(s);
    setPicked(next);
  }

  function submit() {
    if (!name.trim()) { toast("⚠ Pharmacy name required"); return; }
    const statesArr: string[] = [...picked].sort();
    const stored = typeToStored(type);
    onAdd({
      name: name.trim(),
      icon: "🏥",
      location: "—",
      states: statesArr.join(", ") || "—",
      turnaround: "—",
      status: active ? "connected" : "paused",
      type: stored,
      dba: name.trim(),
      npi: npi.trim(),
      ncpdp: ncpdp.trim(),
      contactEmail: email.trim(),
      contactPhone: phone.trim(),
      statesList: statesArr,
      compound,
      ship,
      surescripts: true,
      epcs: false,
      active,
      primary: false,
      orders30d: 0,
      notes: "",
    });
    setName(""); setNpi(""); setNcpdp(""); setEmail(""); setPhone(""); setPicked(new Set()); setStateSearch("");
  }

  return (
    <div className="bg-surface border border-border rounded-lg shadow-xs overflow-hidden">
      <div className="py-3.5 px-4 border-b border-border flex items-center gap-3">
        <div className="w-[34px] h-[34px] rounded-[10px] bg-brand-soft text-brand flex items-center justify-center text-[15px] flex-shrink-0">⚡</div>
        <div>
          <div className="text-[13.5px] font-bold text-ink tracking-tight">Quick Add Pharmacy</div>
          <div className="text-[11.5px] text-ink-muted">Essential details only</div>
        </div>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="Pharmacy Name" required>
            <input className="form-input" placeholder="e.g. RxElite Compounding" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Type" required>
            <select className="form-select" value={type} onChange={(e) => setType(e.target.value as PharmaTypeStr)}>
              <option>Compounding</option><option>Retail</option><option>Mail Order</option><option>Specialty</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="NPI Number">
            <input className="form-input font-mono text-[12px]" placeholder="10-digit NPI" value={npi} onChange={(e) => setNpi(e.target.value)} />
          </Field>
          <Field label="NCPDP ID">
            <input className="form-input font-mono text-[12px]" placeholder="Surescripts ID" value={ncpdp} onChange={(e) => setNcpdp(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="Primary Email">
            <input type="email" className="form-input" placeholder="rx@pharmacy.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Phone">
            <input type="tel" className="form-input" placeholder="(000) 000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        </div>

        <Field label="Licensed States (click to select)">
          <StatePicker picked={picked} onToggle={toggle} search={stateSearch} onSearchChange={setStateSearch} />
        </Field>

        <div className="bg-surface-2 border border-border rounded-[11px] px-3.5 mb-3 mt-3">
          <ToggleRow label="Can Compound"      sub="GLP-1s, NAD+, custom formulations"  value={compound} onChange={() => setCompound(!compound)} />
          <ToggleRow label="Ship to Home"      sub="Supports direct patient delivery"   value={ship}     onChange={() => setShip(!ship)} />
          <ToggleRow label="Active in Network" sub="Route orders to this pharmacy"      value={active}   onChange={() => setActive(!active)} last />
        </div>

        <button className="btn btn-primary w-full justify-center" style={{ padding: 10 }} onClick={submit}>+ Add to Network</button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// COVERAGE CARD
// ────────────────────────────────────────────────────────────────────────
function CoverageCard({ coverage }: { coverage: { covered: Map<string, string[]>; total: number; coveredCount: number; pct: number } }) {
  return (
    <div className="bg-surface border border-border rounded-lg shadow-xs overflow-hidden">
      <div className="py-3.5 px-4 border-b border-border flex items-center gap-3">
        <div className="w-[34px] h-[34px] rounded-[10px] bg-purple-soft text-purple flex items-center justify-center text-[15px] flex-shrink-0">🗺️</div>
        <div>
          <div className="text-[13.5px] font-bold text-ink tracking-tight">Coverage by State</div>
          <div className="text-[11.5px] text-ink-muted">Active-pharmacy coverage map</div>
        </div>
      </div>
      <div className="py-3.5 px-4">
        <div className="flex items-center gap-3 mb-3.5">
          <div className="text-[13px] font-bold text-ink whitespace-nowrap">
            {coverage.coveredCount}/{coverage.total} states
          </div>
          <div className="bg-surface-3 rounded-[20px] h-[7px] flex-1 overflow-hidden">
            <div className="h-full rounded-[20px] bg-brand" style={{ width: `${coverage.pct}%` }} />
          </div>
          <div className="text-[12px] font-bold text-brand-dk">{coverage.pct}%</div>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(38px,1fr))] gap-1">
          {ALL_STATES.map((s) => {
            const isCovered = coverage.covered.has(s);
            const list = coverage.covered.get(s) || [];
            const title = isCovered ? `Covered by: ${list.join(", ")}` : `No active pharmacy licensed in ${s}`;
            return (
              <div
                key={s}
                title={title}
                className={[
                  "py-1 px-1.5 rounded-[5px] font-mono text-[10px] font-bold text-center border",
                  isCovered ? "bg-brand-soft text-brand-dk border-brand-soft" : "bg-surface-3 text-ink-muted-2 border-border",
                ].join(" ")}
              >
                {s}
              </div>
            );
          })}
        </div>
        <div className="mt-3 text-[10.5px] text-ink-muted flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-[3px] bg-brand-soft border border-brand-soft" />
          Covered by at least one active pharmacy
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// STATE PICKER (shared by Quick Add + Modal)
// ────────────────────────────────────────────────────────────────────────
function StatePicker({ picked, onToggle, search, onSearchChange }: {
  picked: Set<string>;
  onToggle: (s: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
}) {
  const upper = search.toUpperCase().trim();
  const arr = Array.from(picked).sort();
  return (
    <div className="bg-surface-2 border border-border rounded-[10px] p-3">
      <input
        type="text"
        className="w-full py-1.5 px-3 rounded-md border border-border bg-surface font-sans text-[12.5px] text-ink outline-none mb-2.5 focus:border-brand focus:shadow-[0_0_0_3px_var(--color-brand-glow)]"
        placeholder="Search states…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(40px,1fr))] gap-1 max-h-[200px] overflow-y-auto">
        {ALL_STATES.map((s) => {
          const visible = !upper || s.includes(upper);
          if (!visible) return null;
          const selected = picked.has(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => onToggle(s)}
              className={[
                "py-1.5 px-1 rounded-md font-mono text-[11px] font-semibold border transition-colors",
                selected
                  ? "bg-brand text-white border-brand"
                  : "bg-surface text-ink-2 border-border hover:border-border-2 hover:bg-surface-3",
              ].join(" ")}
            >
              {s}
            </button>
          );
        })}
      </div>
      <div className="mt-2.5 text-[10px] text-ink-muted font-bold uppercase tracking-[0.8px]">
        Selected ({arr.length}):
      </div>
      <div className="flex flex-wrap gap-1 mt-1.5 min-h-[24px]">
        {arr.length === 0 ? (
          <span className="text-[11px] text-ink-muted-2 italic">No states selected yet</span>
        ) : (
          arr.map((s) => (
            <span key={s} className="state-tag inline-flex items-center gap-1">
              {s}
              <button
                type="button"
                onClick={() => onToggle(s)}
                className="opacity-55 hover:opacity-100 ml-0.5"
                aria-label={`Remove ${s}`}
              >
                ✕
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// TOGGLE ROW
// ────────────────────────────────────────────────────────────────────────
function ToggleRow({ label, sub, value, onChange, last }: { label: string; sub: string; value: boolean; onChange: () => void; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2.5 ${last ? "" : "border-b border-border"}`}>
      <div>
        <div className="text-[12.5px] font-semibold text-ink">{label}</div>
        <div className="text-[11px] text-ink-muted mt-px">{sub}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={onChange}
        className={`relative w-[38px] h-[22px] rounded-[11px] transition-colors flex-shrink-0 ${value ? "bg-brand" : "bg-border-2"}`}
      >
        <span
          className="absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.2)] transition-[left]"
          style={{ left: value ? 19 : 3 }}
        />
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// FORM FIELD
// ────────────────────────────────────────────────────────────────────────
function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11.5px] font-semibold text-ink-2">
        {label}{required && <span className="text-red ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// ADD / EDIT MODAL (full bask shape)
// ────────────────────────────────────────────────────────────────────────
interface FormState {
  name: string; dba: string; type: PharmaTypeStr; npi: string; ncpdp: string; dea: string; ein: string;
  contact: string; email: string; phone: string; fax: string; website: string;
  addr: string; city: string; state: string; zip: string;
  states: Set<string>;
  compound: boolean; ship: boolean; surescripts: boolean; epcs: boolean; active: boolean; primary: boolean;
  notes: string;
}
function emptyForm(): FormState {
  return {
    name: "", dba: "", type: "Compounding", npi: "", ncpdp: "", dea: "", ein: "",
    contact: "", email: "", phone: "", fax: "", website: "",
    addr: "", city: "", state: "", zip: "",
    states: new Set(),
    compound: true, ship: true, surescripts: true, epcs: false, active: true, primary: false,
    notes: "",
  };
}
function formFromPharm(p: Pharmacy): FormState {
  return {
    name: p.name,
    dba: p.dba || "",
    type: typeToDisplay(p.type),
    npi: p.npi || "",
    ncpdp: p.ncpdp || "",
    dea: p.dea || "",
    ein: p.ein || "",
    contact: p.contactName || "",
    email: p.contactEmail || "",
    phone: p.contactPhone || "",
    fax: p.fax || "",
    website: p.website || "",
    addr: p.addr || "",
    city: p.city || "",
    state: p.state || "",
    zip: p.zip || "",
    states: new Set(p.statesList || []),
    compound: !!p.compound, ship: !!p.ship, surescripts: !!p.surescripts, epcs: !!p.epcs,
    active: p.active !== false, primary: !!p.primary,
    notes: p.notes || "",
  };
}

function AddEditModal({ editing, onClose, onSave }: {
  editing: Pharmacy | null;
  onClose: () => void;
  onSave: (input: Omit<Pharmacy, "id">) => void;
}) {
  const [form, setForm] = useState<FormState>(() => (editing ? formFromPharm(editing) : emptyForm()));
  const [stateSearch, setStateSearch] = useState("");

  function set<K extends keyof FormState>(key: K, value: FormState[K]) { setForm((f) => ({ ...f, [key]: value })); }
  function toggleState(s: string) {
    setForm((f) => {
      const next = new Set(f.states);
      if (next.has(s)) next.delete(s); else next.add(s);
      return { ...f, states: next };
    });
  }

  function submit() {
    if (!form.name.trim()) { toast("⚠ Pharmacy name required"); return; }
    if (!form.email.trim()) { toast("⚠ Email required"); return; }
    const statesArr: string[] = [...form.states].sort();
    const stored = typeToStored(form.type);
    const out: Omit<Pharmacy, "id"> = {
      name: form.name.trim(),
      icon: editing?.icon || "🏥",
      location: form.city.trim() ? `${form.city.trim()}${form.state ? ", " + form.state : ""}` : "—",
      states: statesArr.join(", ") || "—",
      turnaround: editing?.turnaround || "48h",
      status: form.active ? "connected" : "paused",
      type: stored,
      contactName: form.contact.trim(),
      contactEmail: form.email.trim(),
      contactPhone: form.phone.trim(),
      apiEndpoint: editing?.apiEndpoint,
      apiKey: editing?.apiKey,
      monthlyOrders: editing?.monthlyOrders,
      successRate: editing?.successRate,
      avgFulfillmentDays: editing?.avgFulfillmentDays,
      contractedSince: editing?.contractedSince,
      dba: form.dba.trim() || form.name.trim(),
      npi: form.npi.trim(),
      ncpdp: form.ncpdp.trim(),
      dea: form.dea.trim(),
      ein: form.ein.trim(),
      fax: form.fax.trim(),
      website: form.website.trim(),
      addr: form.addr.trim(),
      city: form.city.trim(),
      state: form.state,
      zip: form.zip.trim(),
      statesList: statesArr,
      compound: form.compound, ship: form.ship, surescripts: form.surescripts, epcs: form.epcs,
      active: form.active, primary: form.primary,
      notes: form.notes.trim(),
      orders30d: editing?.orders30d ?? 0,
    };
    onSave(out);
  }

  return (
    <div className="modal-overlay show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal m-auto w-[780px] max-w-full bg-surface border border-border rounded-lg shadow-xl flex flex-col" style={{ maxHeight: "calc(100vh - 48px)" }}>
        {/* Head */}
        <div className="py-4 px-6 border-b border-border flex items-center gap-3 sticky top-0 bg-surface z-10 rounded-t-lg">
          <div className="w-9 h-9 rounded-[10px] bg-brand-soft text-brand flex items-center justify-center text-[16px] flex-shrink-0">🏥</div>
          <div className="text-[15px] font-bold text-ink tracking-tight">
            {editing ? `Edit Pharmacy — ${editing.name}` : "Add Partner Pharmacy"}
          </div>
          <button type="button" onClick={onClose} className="ml-auto w-[30px] h-[30px] rounded-md bg-surface-3 text-ink-muted hover:bg-red-soft hover:text-red transition-colors flex items-center justify-center text-[13px]">✕</button>
        </div>

        {/* Body */}
        <div className="py-5 px-6 overflow-y-auto flex-1">
          <FormSection title="Pharmacy Identity">
            <Row cols={2}>
              <Field label="Pharmacy Name" required>
                <input className="form-input" placeholder="e.g. BioRx Compounding Pharmacy" value={form.name} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <Field label="DBA / Brand Name">
                <input className="form-input" placeholder="Trading name (if different)" value={form.dba} onChange={(e) => set("dba", e.target.value)} />
              </Field>
            </Row>
            <Row cols={3}>
              <Field label="Pharmacy Type" required>
                <select className="form-select" value={form.type} onChange={(e) => set("type", e.target.value as PharmaTypeStr)}>
                  <option>Compounding</option><option>Retail</option><option>Mail Order</option><option>Specialty</option><option>Hospital</option><option>LTC</option>
                </select>
              </Field>
              <Field label="NPI Number">
                <input className="form-input font-mono text-[12px]" placeholder="10-digit NPI" value={form.npi} onChange={(e) => set("npi", e.target.value)} />
              </Field>
              <Field label="NCPDP ID">
                <input className="form-input font-mono text-[12px]" placeholder="NCPDP / Surescripts" value={form.ncpdp} onChange={(e) => set("ncpdp", e.target.value)} />
              </Field>
            </Row>
            <Row cols={2}>
              <Field label="DEA Number">
                <input className="form-input font-mono text-[12px]" placeholder="DEA Registration #" value={form.dea} onChange={(e) => set("dea", e.target.value)} />
              </Field>
              <Field label="Tax ID / EIN">
                <input className="form-input font-mono text-[12px]" placeholder="XX-XXXXXXX" value={form.ein} onChange={(e) => set("ein", e.target.value)} />
              </Field>
            </Row>
          </FormSection>

          <FormSection title="Contact & Address">
            <Row cols={3}>
              <Field label="Primary Contact Name">
                <input className="form-input" placeholder="Pharmacist-in-Charge" value={form.contact} onChange={(e) => set("contact", e.target.value)} />
              </Field>
              <Field label="Email" required>
                <input type="email" className="form-input" placeholder="rx@pharmacy.com" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </Field>
              <Field label="Phone">
                <input type="tel" className="form-input" placeholder="(000) 000-0000" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </Field>
            </Row>
            <Row cols={2}>
              <Field label="Fax">
                <input type="tel" className="form-input" placeholder="(000) 000-0000" value={form.fax} onChange={(e) => set("fax", e.target.value)} />
              </Field>
              <Field label="Website">
                <input type="url" className="form-input" placeholder="https://pharmacy.com" value={form.website} onChange={(e) => set("website", e.target.value)} />
              </Field>
            </Row>
            <Field label="Street Address">
              <input className="form-input" placeholder="123 Pharmacy Drive, Suite 100" value={form.addr} onChange={(e) => set("addr", e.target.value)} />
            </Field>
            <Row cols={3}>
              <Field label="City"><input className="form-input" placeholder="Miami" value={form.city} onChange={(e) => set("city", e.target.value)} /></Field>
              <Field label="State">
                <select className="form-select" value={form.state} onChange={(e) => set("state", e.target.value)}>
                  <option value="">Select state…</option>
                  {ALL_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="ZIP"><input className="form-input" placeholder="33101" value={form.zip} onChange={(e) => set("zip", e.target.value)} /></Field>
            </Row>
          </FormSection>

          <FormSection title={<>Licensed States <span className="text-ink-muted font-normal normal-case tracking-normal">(select all states this pharmacy is licensed in)</span></>}>
            <StatePicker picked={form.states} onToggle={toggleState} search={stateSearch} onSearchChange={setStateSearch} />
          </FormSection>

          <FormSection title="Capabilities & Integration">
            <div className="bg-surface-2 border border-border rounded-[11px] px-4">
              <ToggleRow label="Compounding Pharmacy"    sub="Can compound GLP-1, NAD+, and custom formulations" value={form.compound}    onChange={() => set("compound", !form.compound)} />
              <ToggleRow label="Ship to Patient (Direct)" sub="Supports direct-to-patient cold-chain shipping"    value={form.ship}        onChange={() => set("ship", !form.ship)} />
              <ToggleRow label="Surescripts Connected"   sub="Receives e-prescriptions via Surescripts network"   value={form.surescripts} onChange={() => set("surescripts", !form.surescripts)} />
              <ToggleRow label="EPCS Capable"            sub="Can receive controlled substance e-prescriptions"   value={form.epcs}        onChange={() => set("epcs", !form.epcs)} />
              <ToggleRow label="Active in Network"       sub="Orders can be routed to this pharmacy"              value={form.active}      onChange={() => set("active", !form.active)} />
              <ToggleRow label="Preferred / Primary"     sub="Prioritize this pharmacy for GLP-1 routing"          value={form.primary}     onChange={() => set("primary", !form.primary)} last />
            </div>
          </FormSection>

          <FormSection title="Notes" last>
            <textarea
              className="form-input resize-y min-h-[70px] leading-relaxed"
              placeholder="Internal notes, special handling instructions, contract terms…"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </FormSection>
        </div>

        {/* Footer */}
        <div className="py-3.5 px-6 border-t border-border flex gap-2.5 justify-end sticky bottom-0 bg-surface rounded-b-lg">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={submit}>🏥 Save Pharmacy</button>
        </div>
      </div>
    </div>
  );
}

function FormSection({ title, children, last }: { title: ReactNode; children: ReactNode; last?: boolean }) {
  return (
    <div className={last ? "mb-0" : "mb-5"}>
      <div className="text-[10.5px] uppercase tracking-[1px] text-brand-dk font-bold mb-2.5 pb-2 border-b border-dashed border-border">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Row({ cols, children }: { cols: 2 | 3; children: ReactNode }) {
  return <div className={`grid gap-3 ${cols === 2 ? "grid-cols-2 max-[600px]:grid-cols-1" : "grid-cols-3 max-[800px]:grid-cols-1"}`}>{children}</div>;
}

// ────────────────────────────────────────────────────────────────────────
// DELETE CONFIRM
// ────────────────────────────────────────────────────────────────────────
function ConfirmDeleteModal({ name, onCancel, onConfirm }: { name: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="modal-overlay show" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="m-auto w-[380px] max-w-full bg-surface border border-border rounded-lg shadow-xl p-6">
        <div className="text-[36px] text-center mb-2">🗑️</div>
        <div className="text-[16px] font-bold text-ink text-center mb-1.5 tracking-tight">Remove Pharmacy?</div>
        <div className="text-[12.5px] text-ink-muted text-center mb-4 leading-relaxed">
          &ldquo;{name}&rdquo; will be removed from your pharmacy network. This cannot be undone.
        </div>
        <div className="flex gap-2.5">
          <button type="button" className="btn btn-ghost flex-1 justify-center" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-danger flex-1 justify-center" onClick={onConfirm}>Remove</button>
        </div>
      </div>
    </div>
  );
}
