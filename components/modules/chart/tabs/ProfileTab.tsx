"use client";

import { useState } from "react";
import { Pill } from "@/components/ui/Pill";
import { toast } from "@/lib/hooks/useToast";
import { usePatients } from "@/lib/hooks/usePatients";
import { usePermission } from "@/lib/rbac/usePermission";
import { SectionCard, DataField, DataGrid } from "@/components/modules/chart/SectionCard";
import type { Patient, PatientExtra } from "@/lib/types";

const ageFrom = (dob: string) => { if (!dob) return 0; const d = new Date(dob); const a = Math.floor((Date.now() - d.getTime()) / 3.15576e10); return a > 0 && a < 130 ? a : 0; };
const genderLabel = (g: Patient["gender"]) => (g === "F" ? "Female" : g === "M" ? "Male" : "Non-binary");

/** Labeled box used in both read and edit mode so the layout stays identical. */
function Box({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={`bg-surface-2 border border-border rounded-[10px] px-4 py-3 ${full ? "col-span-2" : ""}`}>
      <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted mb-1.5">{label}</div>
      {children}
    </div>
  );
}

export function ProfileTab({ patient, extra }: { patient: Patient; extra: PatientExtra }) {
  const updatePatient = usePatients((s) => s.update);
  const canEdit = usePermission("patients.edit");
  const a = extra.address;

  // Read-mode display values prefer the patient's own (persisted) fields, with
  // the derived demo `extra` as a fallback for seeded patients.
  const dobShown = patient.dob || extra.dob;
  const streetShown = patient.address || a?.street || "";
  const cityShown = patient.city || a?.city || "";
  const stateShown = patient.state || a?.state || "";
  const zipShown = patient.zip || a?.zip || "";

  const init = () => ({
    first: patient.first, last: patient.last,
    dob: patient.dob || "", gender: patient.gender,
    email: patient.email, phone: patient.phone,
    address: streetShown, apt: patient.apt || "", city: cityShown, state: stateShown, zip: zipShown,
    provider: patient.provider, plan: patient.plan, dose: patient.dose,
    allergies: patient.allergies, notes: patient.notes,
  });

  const [editing, setEditing] = useState(false);
  const [f, setF] = useState(init);
  const set = (k: keyof ReturnType<typeof init>, v: string) => setF((prev) => ({ ...prev, [k]: v }));

  function startEdit() { setF(init()); setEditing(true); }
  function cancel() { setEditing(false); }
  function save() {
    const name = `${f.first} ${f.last}`.trim();
    const age = f.dob ? ageFrom(f.dob) || patient.age : patient.age;
    updatePatient(patient.id, {
      first: f.first.trim(), last: f.last.trim(), name,
      dob: f.dob || undefined, gender: f.gender as Patient["gender"], age,
      email: f.email.trim(), phone: f.phone.trim(),
      address: f.address.trim() || undefined, apt: f.apt.trim() || undefined,
      city: f.city.trim() || undefined, state: f.state.trim(), zip: f.zip.trim() || undefined,
      provider: f.provider.trim(), plan: f.plan.trim(), dose: f.dose.trim(),
      allergies: f.allergies.trim() || "None", notes: f.notes,
    });
    setEditing(false);
    toast("✓ Patient details saved");
  }

  const inp = (k: keyof ReturnType<typeof init>, type = "text") => (
    <input className="fi" style={{ width: "100%" }} type={type} value={f[k] as string} onChange={(e) => set(k, e.target.value)} />
  );

  return (
    <div>
      {/* Edit / Save / Cancel bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-[13px] font-bold text-ink">Patient details</div>
        {editing ? (
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={cancel}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={save}>Save changes</button>
          </div>
        ) : (
          canEdit && <button className="btn btn-ghost btn-sm" onClick={startEdit}>✏️ Edit profile</button>
        )}
      </div>

      <div className="grid grid-cols-[1fr_1fr] gap-4 max-[1100px]:grid-cols-1">
        {/* LEFT column */}
        <div>
          <SectionCard title="Identity" icon="👤" iconBg="var(--color-blue-soft)" iconColor="var(--color-blue)">
            <DataGrid>
              {editing ? (
                <>
                  <Box label="First Name">{inp("first")}</Box>
                  <Box label="Last Name">{inp("last")}</Box>
                  <Box label="Date of Birth">{inp("dob", "date")}</Box>
                  <Box label="Gender">
                    <select className="fsel" style={{ width: "100%" }} value={f.gender} onChange={(e) => set("gender", e.target.value)}>
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                      <option value="Other">Non-binary</option>
                    </select>
                  </Box>
                </>
              ) : (
                <>
                  <DataField label="First Name" value={patient.first} />
                  <DataField label="Last Name" value={patient.last} />
                  <DataField label="Date of Birth" value={dobShown} />
                  <DataField label="Gender" value={genderLabel(patient.gender)} />
                </>
              )}
              <DataField label="Patient ID" value={patient.id} mono />
              <DataField label="Gov ID" value={extra.govId} mono />
              <DataField label="ID Verified" value={extra.idVerified ? <Pill intent="green">✓ Verified</Pill> : <Pill intent="amber">Pending</Pill>} />
              <DataField label="Enrolled" value={patient.since} />
            </DataGrid>
          </SectionCard>

          <SectionCard title="Contact" icon="📞" iconBg="var(--color-violet-soft)" iconColor="var(--color-violet)">
            <DataGrid>
              {editing ? (
                <>
                  <Box label="Email" full>{inp("email", "email")}</Box>
                  <Box label="Phone">{inp("phone", "tel")}</Box>
                  <DataField label="Preferred Contact" value="Email" />
                </>
              ) : (
                <>
                  <Box label="Email" full><div className="text-[13px] font-semibold text-ink">{patient.email}</div></Box>
                  <DataField label="Phone" value={patient.phone} mono />
                  <DataField label="Preferred Contact" value="Email" />
                </>
              )}
            </DataGrid>
          </SectionCard>

          <SectionCard title="Shipping Address" icon="📦" iconBg="var(--color-coral-soft)" iconColor="var(--color-coral)">
            <DataGrid>
              {editing ? (
                <>
                  <Box label="Street" full>{inp("address")}</Box>
                  <Box label="Apt / Suite">{inp("apt")}</Box>
                  <Box label="City">{inp("city")}</Box>
                  <Box label="State">{inp("state")}</Box>
                  <Box label="ZIP">{inp("zip")}</Box>
                </>
              ) : (
                <>
                  <Box label="Street" full><div className="text-[14px] font-semibold text-ink">{streetShown || "—"}{patient.apt ? `, ${patient.apt}` : ""}</div></Box>
                  <DataField label="City" value={cityShown || "—"} />
                  <DataField label="State" value={stateShown || "—"} />
                  <DataField label="ZIP" value={zipShown || "—"} mono />
                  <DataField label="Country" value="United States" />
                </>
              )}
            </DataGrid>
          </SectionCard>
        </div>

        {/* RIGHT column */}
        <div>
          <SectionCard title="Clinical Info" icon="🩺" iconBg="var(--color-green-soft)" iconColor="var(--color-green)">
            <DataGrid>
              {editing ? (
                <>
                  <Box label="Assigned Provider">{inp("provider")}</Box>
                  <Box label="Program Plan">{inp("plan")}</Box>
                  <Box label="Current Dose">{inp("dose")}</Box>
                  <DataField label="Protocol Week" value={`Week ${patient.week}`} />
                  <Box label="Allergies" full>{inp("allergies")}</Box>
                </>
              ) : (
                <>
                  <DataField label="Assigned Provider" value={patient.provider} />
                  <DataField label="Program Plan" value={patient.plan} />
                  <DataField label="Current Dose" value={patient.dose} mono />
                  <DataField label="Protocol Week" value={`Week ${patient.week}`} />
                  <DataField label="Start Date" value={patient.since} />
                  <DataField label="A1C (latest)" value={patient.a1c ? `${patient.a1c}%` : "—"} />
                  <Box label="Allergies" full><div className="text-[14px] font-semibold text-ink">{patient.allergies}</div></Box>
                </>
              )}
            </DataGrid>
          </SectionCard>

          {extra.insurance && (
            <SectionCard title="Insurance" icon="💳" iconBg="var(--color-blue-soft)" iconColor="var(--color-blue)">
              <DataGrid>
                <Box label="Carrier" full><div className="text-[14px] font-semibold text-ink">{extra.insurance.carrier}</div></Box>
                <DataField label="Member ID" value={extra.insurance.memberId} mono />
                <DataField label="Group" value={extra.insurance.group} mono />
              </DataGrid>
            </SectionCard>
          )}

          <SectionCard title="Tags & Notes" icon="🏷" iconBg="var(--color-pink-soft)" iconColor="var(--color-pink)">
            <div className="flex flex-wrap gap-1.5 mb-3">
              {patient.tags.length === 0 && <span className="text-[11.5px] italic text-ink-muted-2">No tags</span>}
              {patient.tags.map((t) => {
                const isUrgent = t.toLowerCase().startsWith("urgent") || t.toLowerCase().startsWith("disqualified");
                return <Pill key={t} intent={isUrgent ? "red" : t === "New" ? "green" : "muted"}>{t}</Pill>;
              })}
            </div>
            {editing ? (
              <textarea className="fi" style={{ width: "100%", minHeight: 90 }} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Internal notes about this patient…" />
            ) : (
              <div className="text-[13px] text-ink-2 leading-relaxed whitespace-pre-wrap">
                {patient.notes || <span className="italic text-ink-muted">No notes yet</span>}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
