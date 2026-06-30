"use client";

import type { VisitPacket } from "@/lib/types/index";

const BRAND = "#4a8ec7";
const BRAND_DK = "#2f6ea6";
const INK = "#1f2a33";
const MUTED = "#5b6b78";
const BORDER = "#dde3e8";
const SURF2 = "#f4f8fb";
const GREEN = "#2e9e6b";
const AMBER = "#b9802b";

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: MUTED }}>{children}</div>;
}
function SectionBar({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: BRAND_DK, color: "#fff", fontWeight: 700, fontSize: 13, padding: "7px 12px", borderRadius: "8px 8px 0 0", marginTop: 18 }}>
      {children}
    </div>
  );
}

export function VisitPacketPreview({ payload }: { payload: VisitPacket }) {
  const p = payload;
  const cell: React.CSSProperties = { border: `1px solid ${BORDER}`, padding: "6px 9px", fontSize: 12.5, verticalAlign: "top", color: INK };
  const th: React.CSSProperties = { ...cell, background: BRAND_DK, color: "#fff", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 };

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", background: "#fff", color: INK, fontFamily: "Inter, Arial, sans-serif", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
      {/* Header band */}
      <div style={{ background: BRAND, color: "#fff", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>DripVitals</div>
          <div style={{ fontSize: 11, color: "#dbeafe", marginTop: 4 }}>Patient Visit &amp; Consent Record</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 11, color: "#dbeafe" }}>
          <div style={{ fontWeight: 700, color: "#fff", fontSize: 12 }}>{p.visitId}</div>
          <div>Drip Vitals LLC</div>
          <div>support@dripvitals.com</div>
        </div>
      </div>

      <div style={{ padding: "20px 24px 28px" }}>
        {/* Summary strip */}
        <table style={{ width: "100%", borderCollapse: "collapse", background: SURF2 }}>
          <tbody>
            <tr>
              {["CREATED", "STATUS", "PHARMACY ORDER", "ASSIGNED PROVIDER"].map((h) => (
                <td key={h} style={{ ...cell, fontSize: 9.5, fontWeight: 700, color: MUTED, letterSpacing: 0.4 }}>{h}</td>
              ))}
            </tr>
            <tr>
              <td style={{ ...cell, fontWeight: 700 }}>{p.createdDisplay}</td>
              <td style={{ ...cell }}><span style={{ color: GREEN, fontWeight: 700 }}>{p.status}</span></td>
              <td style={cell}>{p.pharmacyOrder || "—"}</td>
              <td style={cell}>{p.provider || "Awaiting assignment"}</td>
            </tr>
          </tbody>
        </table>

        {/* Patient */}
        <div style={{ fontSize: 14, fontWeight: 700, color: BRAND_DK, marginTop: 18, marginBottom: 6 }}>Patient</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={cell}><Label>Full name</Label><div style={{ fontWeight: 700, fontSize: 14 }}>{p.patient.name}</div></td>
              <td style={cell}><Label>Date of birth</Label><div>{p.patient.dob || "—"}{p.patient.age ? ` (${p.patient.age})` : ""}</div></td>
              <td style={cell}><Label>Patient ID</Label><div>{p.patient.patientId}</div></td>
            </tr>
            <tr>
              <td style={cell}><Label>Email</Label><div>{p.patient.email || "—"}</div></td>
              <td style={cell}><Label>Phone</Label><div>{p.patient.phone || "—"}</div></td>
              <td style={cell}><Label>Biological sex</Label><div>{p.patient.sex || "—"}</div></td>
            </tr>
          </tbody>
        </table>

        {/* Shipping */}
        {p.shipping && (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, color: BRAND_DK, marginTop: 18, marginBottom: 6 }}>Shipping address</div>
            <div style={{ border: `1px solid ${BORDER}`, background: SURF2, borderRadius: 8, padding: "10px 12px", fontSize: 13 }}>
              {p.patient.name}<br />
              {p.shipping.line1}{p.shipping.line2 ? `, ${p.shipping.line2}` : ""}<br />
              {[p.shipping.city, p.shipping.state, p.shipping.zip].filter(Boolean).join(", ")}<br />
              United States
            </div>
          </>
        )}

        {/* Treatment */}
        <div style={{ fontSize: 14, fontWeight: 700, color: BRAND_DK, marginTop: 18, marginBottom: 6 }}>Treatment &amp; program</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>{["Program", "Medication prescribed", "Total mg", "Supply", "Price"].map((h) => <td key={h} style={th}>{h}</td>)}</tr>
            <tr>
              <td style={{ ...cell, fontWeight: 700 }}>{p.treatment.program}</td>
              <td style={cell}>{p.treatment.medication}</td>
              <td style={cell}>{p.treatment.totalMg || "—"}</td>
              <td style={cell}>{p.treatment.supply || "—"}</td>
              <td style={{ ...cell, fontWeight: 700 }}>{p.treatment.price}</td>
            </tr>
          </tbody>
        </table>
        {p.treatment.intakeFormName && (
          <div style={{ fontSize: 11.5, color: MUTED, marginTop: 6 }}>
            Intake form completed: <b>{p.treatment.intakeFormName}</b>{p.treatment.intakeFormId ? ` (${p.treatment.intakeFormId})` : ""}
          </div>
        )}

        {/* Consents */}
        <div style={{ fontSize: 14, fontWeight: 700, color: BRAND_DK, marginTop: 18, marginBottom: 6 }}>Consents &amp; authorizations acknowledged</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>{["Document", "Version", "Accepted at checkout"].map((h) => <td key={h} style={th}>{h}</td>)}</tr>
            {p.consents.length === 0 && <tr><td style={cell} colSpan={3}>No consents recorded.</td></tr>}
            {p.consents.map((c, i) => (
              <tr key={i} style={{ background: i % 2 ? SURF2 : "#fff" }}>
                <td style={cell}>{c.title}</td>
                <td style={cell}>{c.version}</td>
                <td style={cell}>{fmtTs(c.acceptedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Attestation + signature */}
        <div style={{ fontSize: 14, fontWeight: 700, color: BRAND_DK, marginTop: 18, marginBottom: 6 }}>Patient attestation &amp; electronic signature</div>
        <div style={{ border: `1px solid ${BORDER}`, background: "#e8f6ef", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, lineHeight: 1.5 }}>
          I, <b>{p.signedName || p.patient.name}</b>, attest that the information I provided is true and complete to the best of my knowledge. I understand the risks and benefits of the prescribed treatment, that results are not guaranteed, and that I may discontinue at any time. I authorize Drip Vitals LLC and its providers and pharmacies to use this information to evaluate, prescribe, and fulfill my treatment.
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
          <tbody>
            <tr>{["Patient e-signature", "Signed", "Provider review"].map((h) => <td key={h} style={th}>{h}</td>)}</tr>
            <tr>
              <td style={{ ...cell, fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 16 }}>{p.signedName || p.patient.name}</td>
              <td style={cell}>{p.signedDisplay || p.createdDisplay}</td>
              <td style={cell}>{p.provider ? <span style={{ color: GREEN, fontWeight: 700 }}>Approved · {p.provider}</span> : "Awaiting provider review"}</td>
            </tr>
          </tbody>
        </table>

        {/* ─── Intake Q&A ─── */}
        <div style={{ marginTop: 28, borderTop: `2px solid ${BORDER}`, paddingTop: 18 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>Medical Intake — Questions &amp; Answers</div>
          <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>Patient responses recorded at intake. Answers are stored as submitted.</div>
        </div>

        {/* Screening summary */}
        <table style={{ width: "100%", borderCollapse: "collapse", background: SURF2, marginTop: 12 }}>
          <tbody>
            <tr>
              {["ELIGIBILITY", "FLAGGED FOR REVIEW", "PROVIDER DECISION"].map((h) => (
                <td key={h} style={{ ...cell, fontSize: 9.5, fontWeight: 700, color: MUTED, letterSpacing: 0.4 }}>{h}</td>
              ))}
            </tr>
            <tr>
              <td style={cell}><span style={{ color: p.screening.eligibility.toLowerCase().includes("not") ? AMBER : GREEN, fontWeight: 700 }}>{p.screening.eligibility}</span></td>
              <td style={cell}><span style={{ color: p.screening.flaggedCount ? AMBER : INK, fontWeight: 700 }}>{p.screening.flaggedCount ? `${p.screening.flaggedCount} item${p.screening.flaggedCount > 1 ? "s" : ""}` : "None"}</span></td>
              <td style={cell}>{p.screening.decision || "Awaiting provider review"}</td>
            </tr>
          </tbody>
        </table>

        {/* Q&A sections */}
        {p.sections.map((sec, si) => (
          <div key={si}>
            <SectionBar>{sec.title}</SectionBar>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {sec.items.map((it, ii) => (
                  <tr key={ii}>
                    <td style={{ ...cell, width: "52%", background: SURF2 }}>
                      <div style={{ fontWeight: 700, fontSize: 12.5 }}>{it.question}</div>
                      {it.helper && <div style={{ fontSize: 10.5, color: MUTED, marginTop: 1 }}>{it.helper}</div>}
                    </td>
                    <td style={cell}>
                      {it.answer}
                      {it.flagged && <span style={{ color: AMBER, fontSize: 10.5, fontWeight: 700 }}> &nbsp;[FLAGGED FOR REVIEW]</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        <div style={{ marginTop: 22, paddingTop: 10, borderTop: `1px solid ${BORDER}`, fontSize: 9.5, color: MUTED }}>
          CONFIDENTIAL — Protected Health Information. Part of the patient&apos;s medical record · Drip Vitals LLC · Visit {p.visitId}
        </div>
      </div>
    </div>
  );
}

function fmtTs(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    }).format(d) + " ET";
  } catch {
    return d.toLocaleString();
  }
}
