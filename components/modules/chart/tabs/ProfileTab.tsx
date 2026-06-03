"use client";

import { Pill } from "@/components/ui/Pill";
import { toast } from "@/lib/hooks/useToast";
import { SectionCard, DataField, DataGrid } from "@/components/modules/chart/SectionCard";
import type { Patient, PatientExtra } from "@/lib/types";

export function ProfileTab({ patient, extra }: { patient: Patient; extra: PatientExtra }) {
  const addr = extra.address;

  return (
    <div className="grid grid-cols-[1fr_1fr] gap-4 max-[1100px]:grid-cols-1">
      {/* LEFT column */}
      <div>
        <SectionCard
          title="Identity"
          icon="👤"
          iconBg="var(--color-blue-soft)"
          iconColor="var(--color-blue)"
          action={<button className="btn btn-ghost btn-sm" onClick={() => toast("✏️ Edit mode opened")}>Edit</button>}
        >
          <DataGrid>
            <DataField label="First Name" value={patient.first} />
            <DataField label="Last Name"  value={patient.last} />
            <DataField label="Date of Birth" value={extra.dob} />
            <DataField label="Gender"     value={extra.gender} />
            <DataField label="Patient ID" value={patient.id} mono />
            <DataField label="Gov ID"     value={extra.govId} mono />
            <DataField label="ID Verified" value={extra.idVerified ? <Pill intent="green">✓ Verified</Pill> : <Pill intent="amber">Pending</Pill>} />
            <DataField label="Enrolled"   value={patient.since} />
          </DataGrid>
        </SectionCard>

        <SectionCard
          title="Contact"
          icon="📞"
          iconBg="var(--color-violet-soft)"
          iconColor="var(--color-violet)"
        >
          <DataGrid>
            <div className="col-span-2 bg-surface-2 border border-border rounded-[10px] px-4 py-3">
              <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted mb-1.5">Email</div>
              <div className="text-[13px] font-semibold text-ink">{patient.email}</div>
            </div>
            <DataField label="Phone"          value={patient.phone} mono />
            <DataField label="Preferred Contact" value="Email" />
          </DataGrid>
        </SectionCard>

        {addr && (
          <SectionCard
            title="Shipping Address"
            icon="📦"
            iconBg="var(--color-coral-soft)"
            iconColor="var(--color-coral)"
            action={<button className="btn btn-ghost btn-sm" onClick={() => toast("✏️ Edit address")}>Edit</button>}
          >
            <DataGrid>
              <div className="col-span-2 bg-surface-2 border border-border rounded-[10px] px-4 py-3">
                <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted mb-1.5">Street</div>
                <div className="text-[14px] font-semibold text-ink">{addr.street}</div>
              </div>
              <DataField label="City"  value={addr.city} />
              <DataField label="State" value={addr.state} />
              <DataField label="ZIP"   value={addr.zip} mono />
              <DataField label="Country" value="United States" />
            </DataGrid>
          </SectionCard>
        )}
      </div>

      {/* RIGHT column */}
      <div>
        <SectionCard
          title="Clinical Info"
          icon="🩺"
          iconBg="var(--color-green-soft)"
          iconColor="var(--color-green)"
        >
          <DataGrid>
            <DataField label="Assigned Provider" value={patient.provider} />
            <DataField label="Program Plan" value={patient.plan} />
            <DataField label="Current Dose" value={patient.dose} mono />
            <DataField label="Protocol Week" value={`Week ${patient.week}`} />
            <DataField label="Start Date" value={patient.since} />
            <DataField label="A1C (latest)" value={patient.a1c ? `${patient.a1c}%` : "—"} />
            <div className="col-span-2 bg-surface-2 border border-border rounded-[10px] px-4 py-3">
              <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted mb-1.5">Allergies</div>
              <div className="text-[14px] font-semibold text-ink">{patient.allergies}</div>
            </div>
          </DataGrid>
        </SectionCard>

        {extra.insurance && (
          <SectionCard
            title="Insurance"
            icon="💳"
            iconBg="var(--color-blue-soft)"
            iconColor="var(--color-blue)"
          >
            <DataGrid>
              <div className="col-span-2 bg-surface-2 border border-border rounded-[10px] px-4 py-3">
                <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted mb-1.5">Carrier</div>
                <div className="text-[14px] font-semibold text-ink">{extra.insurance.carrier}</div>
              </div>
              <DataField label="Member ID" value={extra.insurance.memberId} mono />
              <DataField label="Group" value={extra.insurance.group} mono />
            </DataGrid>
          </SectionCard>
        )}

        {extra.emergencyContact && (
          <SectionCard
            title="Emergency Contact"
            icon="🚨"
            iconBg="var(--color-red-soft)"
            iconColor="var(--color-red)"
          >
            <DataGrid>
              <DataField label="Name"         value={extra.emergencyContact.name} />
              <DataField label="Relationship" value={extra.emergencyContact.relationship} />
              <div className="col-span-2">
                <DataField label="Phone" value={extra.emergencyContact.phone} mono />
              </div>
            </DataGrid>
          </SectionCard>
        )}

        <SectionCard
          title="Tags & Notes"
          icon="🏷"
          iconBg="var(--color-pink-soft)"
          iconColor="var(--color-pink)"
        >
          <div className="flex flex-wrap gap-1.5 mb-3">
            {patient.tags.length === 0 && <span className="text-[11.5px] italic text-ink-muted-2">No tags</span>}
            {patient.tags.map((t) => {
              const isUrgent = t.toLowerCase().startsWith("urgent") || t.toLowerCase().startsWith("disqualified");
              return (
                <Pill key={t} intent={isUrgent ? "red" : t === "New" ? "green" : "muted"}>
                  {t}
                </Pill>
              );
            })}
          </div>
          <div className="text-[13px] text-ink-2 leading-relaxed whitespace-pre-wrap">
            {patient.notes || <span className="italic text-ink-muted">No notes yet</span>}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
