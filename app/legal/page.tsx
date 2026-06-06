import Link from "next/link";
import { LEGAL_DOCS } from "@/lib/legal/documents";

export default function LegalIndexPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#f5f7fb", padding: "32px 16px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 4px", color: "#15181c" }}>Legal & Privacy</h1>
        <p style={{ fontSize: 14, color: "#475467", margin: "0 0 20px" }}>The documents that govern care and your information on this platform.</p>
        <div style={{ display: "grid", gap: 12 }}>
          {LEGAL_DOCS.map((d) => (
            <Link key={d.id} href={`/legal/${d.slug}`} style={{ textDecoration: "none" }}>
              <div style={{ background: "#fff", border: "1px solid #e6e9ef", borderRadius: 14, padding: "16px 18px" }}>
                <div style={{ fontSize: 15.5, fontWeight: 700, color: "#15181c" }}>{d.title}</div>
                <div style={{ fontSize: 13, color: "#475467", margin: "4px 0 6px" }}>{d.summary}</div>
                <div style={{ fontSize: 11.5, color: "#98a2b3" }}>{d.version} · {d.effective} · Read →</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
