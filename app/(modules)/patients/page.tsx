"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { toast } from "@/lib/hooks/useToast";
import { usePatients } from "@/lib/hooks/usePatients";
import { PatientFormModal } from "@/components/modules/PatientFormModal";
import { IntakeInProgressPanel } from "@/components/modules/IntakeInProgressPanel";
import { deriveLifecycle, LIFECYCLE_META, LIFECYCLE_INTENT } from "@/lib/data/lifecycle";
import type { LifecycleStatus, Patient } from "@/lib/types";

type ProgIntent = "blue" | "coral" | "purple" | "teal" | "pink" | "muted";
function programFor(plan: string): { program: string; intent: ProgIntent } {
  const p = (plan || "").toLowerCase();
  if (p.includes("semaglutide") || p.includes("tirzepatide") || p.includes("glp")) return { program: "Weight Loss", intent: "blue" };
  if (p.includes("testosterone") || p.includes("trt")) return { program: "TRT", intent: "coral" };
  if (p.includes("sildenafil") || p.includes("tadalafil")) return { program: "ED", intent: "purple" };
  if (p.includes("nad")) return { program: "NAD+", intent: "teal" };
  if (p.includes("sermorelin")) return { program: "Sermorelin", intent: "pink" };
  if (p.includes("b12") || p.includes("vitamin")) return { program: "Vitamins", intent: "muted" };
  return { program: "Weight Loss", intent: "blue" };
}

interface Row {
  p: Patient;
  lifecycle: LifecycleStatus;
  program: string;
  programIntent: ProgIntent;
  lost: number;
}

const KPI_DEFS: { label: string; status?: LifecycleStatus }[] = [
  { label: "Total Patients" },
  { label: "Active Treatment", status: "active_treatment" },
  { label: "New Leads", status: "new_lead" },
  { label: "Intake Pending", status: "intake_pending" },
  { label: "Awaiting Review", status: "awaiting_review" },
  { label: "Refill Due", status: "refill_due" },
  { label: "Inactive", status: "inactive" },
  { label: "Discharged", status: "discharged" },
];

export default function PatientsPage() {
  const patients = usePatients((s) => s.patients);
  const add = usePatients((s) => s.add);
  const [addOpen, setAddOpen] = useState(false);

  const rows = useMemo<Row[]>(() => patients.map((p) => {
    const { program, intent } = programFor(p.plan);
    return { p, lifecycle: deriveLifecycle(p), program, programIntent: intent, lost: Math.max(0, p.wtStart - p.wt) };
  }), [patients]);

  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState<LifecycleStatus | "">("");
  const [programF, setProgramF] = useState("");
  const [providerF, setProviderF] = useState("");
  const [stateF, setStateF] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [view, setView] = useState<"table" | "cards">("table");

  const programs = useMemo(() => Array.from(new Set(rows.map((r) => r.program))), [rows]);
  const providers = useMemo(() => Array.from(new Set(rows.map((r) => r.p.provider).filter(Boolean))).sort(), [rows]);
  const states = useMemo(() => Array.from(new Set(rows.map((r) => r.p.state).filter(Boolean))).sort(), [rows]);

  const counts = useMemo(() => {
    const m: Partial<Record<LifecycleStatus, number>> = {};
    rows.forEach((r) => { m[r.lifecycle] = (m[r.lifecycle] || 0) + 1; });
    return m;
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows.filter((r) => {
      if (statusF && r.lifecycle !== statusF) return false;
      if (programF && r.program !== programF) return false;
      if (providerF && r.p.provider !== providerF) return false;
      if (stateF && r.p.state !== stateF) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!(r.p.name.toLowerCase().includes(q) || r.p.id.toLowerCase().includes(q))) return false;
      }
      return true;
    });
    if (sortBy === "name") list = [...list].sort((a, b) => a.p.name.localeCompare(b.p.name));
    else if (sortBy === "lost") list = [...list].sort((a, b) => b.lost - a.lost);
    else if (sortBy === "week") list = [...list].sort((a, b) => b.p.week - a.p.week);
    return list;
  }, [rows, statusF, programF, providerF, stateF, search, sortBy]);

  const sel = "text-[12px] font-semibold text-ink-2 bg-surface border border-border rounded-[9px] px-3 py-2 cursor-pointer";
  const wt = (r: Row) => r.p.wt ? (<><b className="font-bold">{r.p.wt}</b> lbs{r.lost > 0 && <span className="text-green font-semibold text-[11px] ml-1.5">↓{r.lost}</span>}</>) : "—";
  const wk = (r: Row) => (r.p.week ? `Wk ${r.p.week}` : "—");

  // ── Portal login status ──────────────────────────────────────────────────
  // "Activated" patients have set their own password (welcome/reset flow); we
  // read the authoritative set from the server. "Invited" is optimistic local
  // feedback after we send a welcome email this session.
  const [activated, setActivated] = useState<Set<string>>(new Set());
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/patient/activation")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && Array.isArray(j?.emails)) setActivated(new Set((j.emails as string[]).map((e) => e.toLowerCase()))); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const isActivated = (p: Patient) => !!p.email && activated.has(p.email.toLowerCase());

  async function sendWelcome(p: Patient): Promise<boolean> {
    if (!p.email) return false;
    try {
      const r = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "welcome", to: p.email, toName: p.name }),
      });
      const d = await r.json().catch(() => null);
      if (r.ok && d?.ok !== false) { setInvited((s) => new Set(s).add(p.email.toLowerCase())); return true; }
      return false;
    } catch { return false; }
  }

  async function sendOne(p: Patient) {
    if (!p.email) { toast(`No email on file for ${p.name}`); return; }
    toast(await sendWelcome(p) ? `✉️ Welcome email sent to ${p.name}` : `Couldn't send to ${p.name}`);
  }

  async function sendBulkInvites() {
    const targets = filtered.map((r) => r.p).filter((p) => p.email && !isActivated(p));
    if (!targets.length) { toast("Everyone shown already has a portal login"); return; }
    setBulkBusy(true);
    let sent = 0;
    for (const p of targets) { if (await sendWelcome(p)) sent++; }
    setBulkBusy(false);
    toast(`✉️ Sent ${sent} welcome email${sent === 1 ? "" : "s"}`);
  }

  return (
    <div className="px-7 py-6 text-[14px]">
      <div className="flex items-center gap-3.5 mb-4 flex-wrap">
        <div>
          <h1 className="text-[21px] font-extrabold tracking-tight">Patients</h1>
          <div className="text-[12px] text-ink-muted mt-0.5">Panel management · track every patient's lifecycle stage, program &amp; progress</div>
        </div>
        <div className="flex-1" />
        <button className="btn btn-ghost btn-sm" onClick={sendBulkInvites} disabled={bulkBusy} title="Email a set-password link to every patient shown who hasn't set up their portal login yet">
          {bulkBusy ? "Sending…" : "✉️ Send login invites"}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => toast("⬇ Exporting…")}>⬇ Export</button>
        <button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>+ Add patient</button>
      </div>

      <IntakeInProgressPanel />

      {/* KPIs */}
      <div className="flex flex-wrap justify-between gap-2.5 mb-3.5">
        {KPI_DEFS.map((k) => {
          const on = k.status ? statusF === k.status : statusF === "";
          const value = k.status ? counts[k.status] || 0 : rows.length;
          return (
            <button
              key={k.label}
              onClick={() => setStatusF(k.status ?? "")}
              className={`bg-surface border rounded-2xl px-4 py-3 text-left transition-shadow hover:shadow-md ${on ? "border-brand ring-2 ring-brand-soft" : "border-border"}`}
            >
              <div className="text-[22px] font-extrabold tracking-tight leading-none">{value}</div>
              <div className="text-[11px] text-ink-muted mt-1.5 whitespace-nowrap">{k.label}</div>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap bg-surface border border-border rounded-xl p-2.5 mb-3">
        <div className="flex-1 min-w-[220px] flex items-center gap-2 bg-surface-2 border border-border rounded-[9px] px-3 py-2">
          <span className="text-ink-muted">🔍</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, patient ID…" className="bg-transparent outline-none text-[12.5px] w-full" />
        </div>
        <select className={sel} value={statusF} onChange={(e) => setStatusF(e.target.value as LifecycleStatus | "")}>
          <option value="">Status</option>
          {Object.keys(LIFECYCLE_META).map((k) => <option key={k} value={k}>{LIFECYCLE_META[k as LifecycleStatus].label}</option>)}
        </select>
        <select className={sel} value={programF} onChange={(e) => setProgramF(e.target.value)}>
          <option value="">Program</option>{programs.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className={sel} value={providerF} onChange={(e) => setProviderF(e.target.value)}>
          <option value="">Provider</option>{providers.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className={sel} value={stateF} onChange={(e) => setStateF(e.target.value)}>
          <option value="">State</option>{states.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className={sel} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="recent">Sort: Recent</option>
          <option value="name">Name A–Z</option>
          <option value="lost">Most weight lost</option>
          <option value="week">Weeks on program</option>
        </select>
        <div className="inline-flex bg-surface-3 rounded-[9px] p-0.5 gap-0.5">
          {(["table", "cards"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`text-[11.5px] font-semibold px-3 py-1.5 rounded-[7px] capitalize ${view === v ? "bg-surface text-brand-dk shadow-sm" : "text-ink-muted"}`}>{v}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      {view === "table" && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="border-collapse w-full min-w-[1180px]">
              <thead><tr className="bg-surface-2">
                {["Patient","Status","Program","Provider","State","Week","Weight","BMI","Next Refill","Last Activity","Portal",""].map((h, i) => (
                  <th key={i} className="text-[10px] uppercase tracking-wide text-ink-muted font-bold text-left px-3 py-2.5 border-b border-border whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.p.id} className="border-b border-border last:border-none hover:bg-surface-2">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-[12px] flex-shrink-0" style={{ background: r.p.color }}>
                          {(r.p.first[0] || "") + (r.p.last[0] || "")}
                        </div>
                        <div>
                          <Link href={`/patients/${r.p.id}`} className="text-brand-dk font-semibold hover:underline">{r.p.name}</Link>
                          <div className="font-mono text-[10.5px] text-ink-muted">{r.p.id}</div>
                          {r.p.intakeProgress && r.p.intakeProgress !== "Completed" && <div className="text-[10.5px] text-amber font-semibold mt-0.5">⏳ Intake: {r.p.intakeProgress}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5"><Pill intent={LIFECYCLE_INTENT[r.lifecycle]} dot>{LIFECYCLE_META[r.lifecycle].label}</Pill></td>
                    <td className="px-3 py-2.5"><Pill intent={r.programIntent}>{r.program}</Pill></td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{r.p.provider || "—"}</td>
                    <td className="px-3 py-2.5">{r.p.state}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{wk(r)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{wt(r)}</td>
                    <td className="px-3 py-2.5">{r.p.bmi || "—"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{r.p.nextRefill || "—"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-ink-muted">{r.p.lastVisit || "—"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {isActivated(r.p)
                        ? <Pill intent="green" dot>Active</Pill>
                        : !r.p.email
                          ? <span className="text-ink-muted text-[11px]">No email</span>
                          : invited.has(r.p.email.toLowerCase())
                            ? <span className="text-[11px] text-ink-muted">✓ Invited · <button className="text-brand font-semibold hover:underline" onClick={() => sendOne(r.p)}>Resend</button></span>
                            : <button className="text-[11.5px] text-brand font-semibold hover:underline" onClick={() => sendOne(r.p)}>Send invite</button>}
                    </td>
                    <td className="px-3 py-2.5 text-right"><Link href={`/patients/${r.p.id}`} className="text-ink-muted hover:text-ink">›</Link></td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={12} className="px-3 py-10 text-center text-ink-muted text-[12px]">No patients match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex items-center px-4 py-2.5 border-t border-border text-[12px] text-ink-muted">
            Showing <b className="text-ink-2 mx-1">{filtered.length}</b> of <b className="text-ink-2 mx-1">{rows.length}</b> patients
          </div>
        </div>
      )}

      {/* Cards */}
      {view === "cards" && (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(264px, 1fr))" }}>
          {filtered.map((r) => (
            <Link key={r.p.id} href={`/patients/${r.p.id}`} className="bg-surface border border-border rounded-2xl p-3.5 hover:shadow-md transition-shadow block">
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-[14px]" style={{ background: r.p.color }}>
                  {(r.p.first[0] || "") + (r.p.last[0] || "")}
                </div>
                <div className="min-w-0">
                  <div className="text-brand-dk font-semibold truncate">{r.p.name}</div>
                  <div className="font-mono text-[10.5px] text-ink-muted">{r.p.id}</div>
                </div>
              </div>
              <div className="flex gap-1.5 flex-wrap mb-2.5">
                <Pill intent={LIFECYCLE_INTENT[r.lifecycle]} dot>{LIFECYCLE_META[r.lifecycle].label}</Pill>
                <Pill intent={r.programIntent}>{r.program}</Pill>
              </div>
              <div className="grid grid-cols-2 gap-y-2 gap-x-2.5 text-[11.5px]">
                <div><div className="text-ink-muted">Weight</div><div className="font-semibold">{wt(r)}</div></div>
                <div><div className="text-ink-muted">BMI</div><div className="font-semibold">{r.p.bmi || "—"}</div></div>
                <div><div className="text-ink-muted">Provider</div><div className="font-semibold">{r.p.provider || "—"}</div></div>
                <div><div className="text-ink-muted">State</div><div className="font-semibold">{r.p.state}</div></div>
                <div><div className="text-ink-muted">{r.p.week ? "Week" : "Stage"}</div><div className="font-semibold">{wk(r)}</div></div>
                <div><div className="text-ink-muted">Next Refill</div><div className="font-semibold">{r.p.nextRefill || "—"}</div></div>
              </div>
            </Link>
          ))}
          {filtered.length === 0 && <div className="text-ink-muted text-[12px] py-10 text-center col-span-full">No patients match these filters.</div>}
        </div>
      )}

      <PatientFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={(data) => {
          const created = add(data as Omit<Patient, "id">);
          setAddOpen(false);
          toast(`✓ ${created.name} added`);
        }}
      />
      <Toast />
    </div>
  );
}
