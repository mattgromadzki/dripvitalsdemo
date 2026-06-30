"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { Pill } from "@/components/ui/Pill";
import { toast } from "@/lib/hooks/useToast";
import { SectionCard } from "@/components/modules/chart/SectionCard";
import { usePatientDocuments } from "@/lib/hooks/usePatientDocuments";
import type { Patient, PatientExtra } from "@/lib/types";

const TYPE_ICON: Record<string, string> = {
  "Lab Report":      "🧪",
  "Consent Form":    "📋",
  "ID Verification": "🪪",
  "Insurance":       "🏥",
  "Progress Photo":  "📷",
  "Prescription":    "💊",
  "Visit Record":    "📋",
  "Intake":          "📝",
};

const TYPE_INTENT: Record<string, "teal" | "green" | "blue" | "purple" | "amber" | "coral"> = {
  "Lab Report":      "teal",
  "Consent Form":    "green",
  "ID Verification": "blue",
  "Insurance":       "purple",
  "Progress Photo":  "amber",
  "Prescription":    "coral",
  "Visit Record":    "blue",
  "Intake":          "teal",
};

const DOC_TYPE_LABEL: Record<string, string> = {
  rx: "Prescription", visit: "Visit Record", consent: "Consent Form", intake: "Intake", lab: "Lab Report", id: "ID Verification", other: "Document",
};

interface Row {
  id:        string;
  name:      string;
  type:      string;
  date:      string;
  size:      string;
  isRx:      boolean;
  openable?: boolean;
  rxDocId?:  string;
  signedBy?: string;
}

export function DocumentsTab({ patient, extra }: { patient: Patient; extra: PatientExtra }) {
  // Dynamic docs (Rx orders saved via e-Prescribe submit) — from shared store
  const allDocs = usePatientDocuments((s) => s.documents);
  const dynamicRows: Row[] = useMemo(
    () =>
      allDocs
        .filter((d) => d.patientId === patient.id)
        .map((d) => ({
          id:       d.id,
          name:     d.title,
          type:     DOC_TYPE_LABEL[d.category] || "Document",
          date:     d.createdDate,
          size:     d.category === "visit" ? "Visit packet" : "1 PDF page",
          isRx:     d.category === "rx",
          openable: d.category === "rx" || d.category === "visit",
          rxDocId:  d.id,
          signedBy: d.signedBy,
        })),
    [allDocs, patient.id]
  );

  // Static seed docs from PatientExtra
  const staticRows: Row[] = useMemo(
    () =>
      extra.documents.map((d) => ({
        id:   `static-${d.name}`,
        name: d.name,
        type: d.type,
        date: d.date,
        size: d.size,
        isRx: false,
      })),
    [extra.documents]
  );

  const rows: Row[] = [...dynamicRows, ...staticRows];

  const counts = rows.reduce<Record<string, number>>((acc, d) => {
    acc[d.type] = (acc[d.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      {rows.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-4 mb-4 shadow-xs">
          <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted mb-2.5">
            Document Summary · {rows.length} on file
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(counts).map(([type, n]) => (
              <div
                key={type}
                className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-pill bg-surface-2 border border-border text-[11.5px] font-semibold text-ink-2"
              >
                <span>{TYPE_ICON[type] || "📄"}</span>
                <span>{type}</span>
                <span className="text-ink-muted-2">·</span>
                <span className="font-mono text-[11px]">{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <SectionCard
        title="Patient Documents"
        icon="📁"
        iconBg="var(--color-blue-soft)"
        iconColor="var(--color-blue)"
        action={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => toast("📥 Generating ZIP of all documents…")}>
              📥 Download All
            </button>
            <button className="btn btn-primary btn-sm ml-1" onClick={() => toast("📤 Upload dialog opened")}>
              + Upload
            </button>
          </>
        }
      >
        {rows.length === 0 ? (
          <div className="py-10 text-center text-ink-muted">
            <div className="text-[36px] opacity-40 mb-2">📁</div>
            <div className="text-[14px] font-bold mb-1 text-ink">No documents yet</div>
            <div className="text-[12px]">
              {patient.first} doesn&rsquo;t have any uploaded documents.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full border-collapse text-[13px]">
              <thead className="bg-surface-2">
                <tr>
                  <Th>Document Name</Th>
                  <Th>Type</Th>
                  <Th>Date Added</Th>
                  <Th>Size</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} className="hover:bg-surface-2 transition-colors">
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <span className="text-[20px] flex-shrink-0">{TYPE_ICON[d.type] || "📄"}</span>
                        <div className="min-w-0">
                          <div className="font-semibold text-[13px] text-ink truncate">{d.name}</div>
                          {d.signedBy && (
                            <div className="text-[10.5px] text-ink-muted mt-0.5">Signed by {d.signedBy}</div>
                          )}
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <Pill intent={TYPE_INTENT[d.type] || "muted"}>{d.type}</Pill>
                    </Td>
                    <Td>
                      <span className="font-mono text-[11.5px] text-ink-muted">{d.date}</span>
                    </Td>
                    <Td>
                      <span className="text-[12px] text-ink-muted">{d.size}</span>
                    </Td>
                    <Td>
                      <div className="flex gap-1">
                        {(d.isRx || d.openable) && d.rxDocId ? (
                          <>
                            <Link
                              href={`/documents/${d.rxDocId}`}
                              className="px-2.5 py-1 rounded-md bg-brand-soft border border-brand-soft text-[11px] font-semibold text-brand-dk hover:bg-brand hover:text-white transition-colors"
                            >
                              Open
                            </Link>
                            <Link
                              href={`/documents/${d.rxDocId}`}
                              className="w-7 h-7 rounded-md bg-surface-2 border border-border flex items-center justify-center text-[12px] hover:bg-brand-soft hover:border-brand transition-colors"
                              title="Open & Download as PDF"
                            >
                              ⬇
                            </Link>
                          </>
                        ) : (
                          <>
                            <button
                              className="px-2.5 py-1 rounded-md bg-surface-2 border border-border text-[11px] font-semibold text-ink-2 hover:bg-brand-soft hover:border-brand hover:text-brand-dk transition-colors"
                              onClick={() => toast(`👁 Viewing ${d.name}`)}
                            >
                              View
                            </button>
                            <button
                              className="w-7 h-7 rounded-md bg-surface-2 border border-border flex items-center justify-center text-[12px] hover:bg-brand-soft hover:border-brand transition-colors"
                              onClick={() => toast(`📥 Downloading ${d.name}`)}
                              title="Download"
                            >
                              📥
                            </button>
                          </>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Document Retention Policy"
        icon="🗄"
        iconBg="var(--color-purple-soft)"
        iconColor="var(--color-purple)"
      >
        <div className="text-[12.5px] text-ink-2 leading-relaxed">
          Patient documents are retained for <strong>7 years</strong> after the last visit per HIPAA and state medical
          record requirements. Documents are encrypted at rest with AES-256 and in transit with TLS 1.3.
          Access is logged in the audit trail.
        </div>
      </SectionCard>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="py-2.5 px-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-ink-muted border-b border-border whitespace-nowrap">
      {children}
    </th>
  );
}

function Td({ children }: { children: ReactNode }) {
  return <td className="py-2.5 px-3.5 border-b border-border align-middle">{children}</td>;
}
