"use client";

import { useMemo, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { usePatients } from "@/lib/hooks/usePatients";
import { getPatientExtra } from "@/lib/data/patientExtras";
import { usePortalRecords } from "@/lib/hooks/usePortalRecords";
import { seedRecordFromPatient, emptyRecord, formatShotDate } from "@/lib/data/portalRecords";
import type { Patient } from "@/lib/types";

/* Patient View — a STAFF tool that MIRRORS the patient portal. Staff pick a
   patient and see exactly what that patient sees and enters in their portal
   (plan, weight progress, logged shots, logged weights, messages) — nothing
   else. It reads the same shared store the portal writes to, and is styled in
   the portal's design (.dv-portal) while staying inside the EMR shell. */
export default function PatientViewPage() {
  const patients = usePatients((s) => s.patients);
  const [patientId, setPatientId] = useState<string>(patients[0]?.id || "");
  const patient = patients.find((p) => p.id === patientId) || patients[0];
  const extra = useMemo(() => (patient ? getPatientExtra(patient) : null), [patient]);

  const records = usePortalRecords((s) => s.records);
  const hydrate = usePortalRecords((s) => s.hydrate);
  const ensureSeeded = usePortalRecords((s) => s.ensureSeeded);
  const seed = useMemo(() => (patient && extra ? seedRecordFromPatient(patient, extra) : emptyRecord()), [patient, extra]);
  useEffect(() => { hydrate(); }, [hydrate]);
  useEffect(() => { if (patient) ensureSeeded(patient.id, seed); }, [patient, seed, ensureSeeded]);
  const record = (patient && records[patient.id]) || seed;

  if (!patient || !extra) {
    return <div className="px-7 py-6"><div className="text-[14px] text-ink-muted">No patients available.</div></div>;
  }

  const currentWeight = record.weights.length ? record.weights[record.weights.length - 1].lbs : patient.wt;
  const weightLoss = patient.wtStart - currentWeight;
  const goalWeight = extra.goalWt ?? patient.wtStart - 30;
  const toGo = Math.max(0, currentWeight - goalWeight);

  const lastShot = record.shots[0];
  const lastWeight = record.weights[record.weights.length - 1];
  const lastMsg = record.messages[record.messages.length - 1];

  return (
    <div className="dv-portal" style={{ padding: "22px 26px", minHeight: "auto" }}>
      {/* Staff banner + patient picker */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
          background: "var(--amber-soft)", border: "1px solid var(--amber-soft)",
          borderRadius: 12, padding: "10px 16px", marginBottom: 18,
        }}
      >
        <span style={{ fontSize: 15 }}>👁</span>
        <div style={{ flex: 1, minWidth: 240, fontSize: 12.5, color: "var(--amber)", fontWeight: 600 }}>
          Viewing {patient.first} {patient.last}&rsquo;s portal as a staff member.
          <span style={{ color: "var(--text-2)", fontWeight: 400, marginLeft: 4 }}>
            This mirrors what the patient sees and enters.
          </span>
        </div>
        <PatientSearchSelect patients={patients} value={patient.id} onChange={setPatientId} />
      </div>

      {/* Plan hero — mirrors the portal Home hero */}
      <div className="hero">
        <div className="hero-inner">
          <div>
            <div className="hero-title">{patient.plan}</div>
            <div className="hero-sub">{patient.dose} · Active subscription</div>
            <div className="hero-meta">
              <Meta lbl="Current dose" val={patient.dose} />
              <Meta lbl="Next refill" val={patient.nextRefill} />
              <Meta lbl="Week" val={`Week ${patient.week}`} />
            </div>
          </div>
          <div className="hero-vial">💉</div>
        </div>
      </div>

      {/* Weight stat cards — same three the patient sees */}
      <div className="row three">
        <Stat lbl="Starting weight" val={<>{patient.wtStart} <Unit /></>} />
        <Stat lbl="Current weight" val={<>{currentWeight} <Unit /></>} trend={`↓ ${weightLoss} lbs total`} />
        <Stat lbl="Goal" val={<>{goalWeight} <Unit /></>} trend={`${toGo} lbs to go`} />
      </div>

      {/* Recent activity + Shot history (what the patient logged) */}
      <div className="row two">
        <div className="card">
          <div className="card-h">Recent activity</div>
          <div className="timeline">
            {lastShot && <Tl title={`Shot logged · ${lastShot.strength}${lastShot.unit} ${lastShot.medication}`} desc={`${lastShot.site} · ${formatShotDate(lastShot.date)}`} />}
            {lastWeight && <Tl title={`Weight logged · ${lastWeight.lbs} lbs`} desc={lastWeight.date} />}
            {lastMsg && <Tl title={`Message · ${lastMsg.from === "patient" ? patient.first : "Care team"}`} desc={lastMsg.text} />}
            {!lastShot && !lastWeight && !lastMsg && <Empty ico="🗒️" text="No activity yet" />}
          </div>
        </div>

        <div className="card">
          <div className="card-h">Shot history <span className="right">{record.shots.length} logged</span></div>
          {record.shots.length > 0 ? (
            <div className="shot-log-list">
              {record.shots.map((s) => (
                <div key={s.id} className="shot-log-row">
                  <div className="shot-log-ico">💉</div>
                  <div className="shot-log-body">
                    <div className="shot-log-title">{formatShotDate(s.date)} · {s.strength}{s.unit} {s.medication}</div>
                    <div className="shot-log-meta">{s.site}</div>
                  </div>
                  <span className="pill active">Logged</span>
                </div>
              ))}
            </div>
          ) : <Empty ico="💉" text="No shots logged yet" />}
        </div>
      </div>

      {/* Logged weights + Messages */}
      <div className="row two">
        <div className="card">
          <div className="card-h">Logged weights <span className="right">{record.weights.length} entries</span></div>
          {record.weights.length > 0 ? (
            <div className="timeline">
              {[...record.weights].reverse().map((w) => <Tl key={w.id} title={`${w.lbs} lbs`} desc={w.date} />)}
            </div>
          ) : <Empty ico="⚖️" text="No weights logged yet" />}
        </div>

        <div className="card">
          <div className="card-h">Messages <span className="right">{record.messages.length} total</span></div>
          {record.messages.length > 0 ? (
            <div className="timeline">
              {[...record.messages].slice(-6).reverse().map((m) => (
                <Tl key={m.id} title={`${m.from === "patient" ? patient.first : "Care team"} · ${m.time}`} desc={m.text} />
              ))}
            </div>
          ) : <Empty ico="💬" text="No messages yet" />}
        </div>
      </div>
    </div>
  );
}

function Unit() { return <span style={{ fontSize: 14, color: "var(--muted)" }}>lbs</span>; }
function Meta({ lbl, val }: { lbl: string; val: string }) {
  return <div className="hero-meta-item"><div className="hero-meta-lbl">{lbl}</div><div className="hero-meta-val">{val}</div></div>;
}
function Stat({ lbl, val, trend }: { lbl: string; val: ReactNode; trend?: string }) {
  return <div className="stat-card"><div className="stat-lbl">{lbl}</div><div className="stat-val">{val}</div>{trend && <div className="stat-trend">{trend}</div>}</div>;
}
function Tl({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="timeline-item">
      <div className="timeline-dot done">✓</div>
      <div className="timeline-body"><div className="timeline-title">{title}</div><div className="timeline-desc">{desc}</div></div>
    </div>
  );
}
function Empty({ ico, text }: { ico: string; text: string }) {
  return (
    <div style={{ padding: "24px 0", textAlign: "center", color: "var(--muted)" }}>
      <div style={{ fontSize: 28, opacity: 0.4, marginBottom: 6 }}>{ico}</div>
      <div style={{ fontSize: 13 }}>{text}</div>
    </div>
  );
}

/* Type-to-search patient picker (combobox): a search box that filters a
   dropdown of patients by name or ID as you type. */
function PatientSearchSelect({ patients, value, onChange }: {
  patients: Patient[];
  value: string;
  onChange: (id: string) => void;
}) {
  const selected = patients.find((p) => p.id === value);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const q = query.trim().toLowerCase();
  const matches = q
    ? patients.filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
    : patients;

  function pick(p: Patient) {
    onChange(p.id);
    setQuery("");
    setOpen(false);
  }

  return (
    <div style={{ position: "relative", width: 280, maxWidth: "100%" }}>
      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, pointerEvents: "none", opacity: 0.7 }}>🔍</span>
      <input
        className="form-input"
        style={{ paddingLeft: 32 }}
        placeholder="Search patients by name…"
        value={open ? query : selected ? `${selected.name} (${selected.id})` : ""}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "Escape") { setOpen(false); (e.target as HTMLInputElement).blur(); }
          if (e.key === "Enter" && matches[0]) pick(matches[0]);
        }}
      />
      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10,
            boxShadow: "0 8px 24px rgba(20,40,30,.14)", maxHeight: 300, overflowY: "auto", padding: 4,
          }}
        >
          {matches.length === 0 ? (
            <div style={{ padding: "14px 12px", fontSize: 12.5, color: "var(--muted)", textAlign: "center" }}>No patients found</div>
          ) : matches.slice(0, 100).map((p) => (
            <div
              key={p.id}
              onMouseDown={(e) => { e.preventDefault(); pick(p); }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                padding: "9px 10px", borderRadius: 7, cursor: "pointer", fontSize: 13,
                background: p.id === value ? "var(--blue-soft)" : "transparent",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--surface-2)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = p.id === value ? "var(--blue-soft)" : "transparent"; }}
            >
              <span style={{ fontWeight: 600, color: "var(--text)" }}>{p.name}</span>
              <span style={{ color: "var(--muted)", fontSize: 11.5, fontFamily: "monospace" }}>{p.id}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
