import Link from "next/link";
import { notFound } from "next/navigation";
import { getLegalDoc, LEGAL_DOCS } from "@/lib/legal/documents";

export function generateStaticParams() {
  return LEGAL_DOCS.map((d) => ({ doc: d.slug }));
}

export default async function LegalDocPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc: slug } = await params;
  const doc = getLegalDoc(slug);
  if (!doc) notFound();

  return (
    <div style={{ minHeight: "100vh", background: "#f5f7fb", padding: "32px 16px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", background: "#fff", border: "1px solid #e6e9ef", borderRadius: 16, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ background: "linear-gradient(135deg,#3b7fc4,#2e6ba8)", padding: "26px 30px", color: "#fff" }}>
          <Link href="/legal" style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, textDecoration: "none" }}>← All documents</Link>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: "8px 0 4px" }}>{doc.title}</h1>
          <div style={{ fontSize: 12.5, opacity: 0.9 }}>{doc.version} · {doc.effective}</div>
        </div>

        {/* Draft banner */}
        <div style={{ background: "#fef0dd", color: "#8a531a", padding: "10px 30px", fontSize: 12.5, borderBottom: "1px solid #f3dcc0" }}>
          ⚠️ <b>Draft template.</b> This language is a starting point only and must be reviewed and finalized by a licensed healthcare attorney before use with patients.
        </div>

        {/* Body */}
        <div style={{ padding: "26px 30px", color: "#1d2733", lineHeight: 1.65 }}>
          <p style={{ fontSize: 14.5, color: "#475467", marginTop: 0 }}>{doc.summary}</p>
          {doc.sections.map((s, i) => (
            <div key={i} style={{ marginTop: 22 }}>
              {s.heading && <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>{s.heading}</h2>}
              {s.paragraphs?.map((p, j) => <p key={j} style={{ fontSize: 14, margin: "0 0 10px" }}>{p}</p>)}
              {s.bullets && (
                <ul style={{ fontSize: 14, paddingLeft: 20, margin: "0 0 10px" }}>
                  {s.bullets.map((b, j) => <li key={j} style={{ marginBottom: 6 }}>{b}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>

        <div style={{ padding: "16px 30px", background: "#f6f8fb", color: "#98a2b3", fontSize: 12, textAlign: "center", borderTop: "1px solid #eef1f6" }}>
          [Clinic Legal Name] · This document is provided for review purposes.
        </div>
      </div>
    </div>
  );
}
