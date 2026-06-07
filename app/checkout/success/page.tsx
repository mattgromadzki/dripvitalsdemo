import Link from "next/link";

export default function CheckoutSuccessPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#f5f7fb", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ maxWidth: 460, width: "100%", background: "#fff", border: "1px solid #e6e9ef", borderRadius: 18, padding: "36px 32px", textAlign: "center" }}>
        <div style={{ fontSize: 46 }}>✅</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "10px 0 6px", color: "#15181c" }}>Payment received</h1>
        <p style={{ fontSize: 14.5, color: "#475467", lineHeight: 1.6, margin: "0 0 8px" }}>
          Thank you — your subscription is set up. A receipt is on its way to your email, and our care team will review your intake and prepare your treatment.
        </p>
        <p style={{ fontSize: 12.5, color: "#98a2b3", margin: "0 0 22px" }}>You won't be charged again until your next billing cycle. You can manage your plan anytime from your patient portal.</p>
        <Link href="/patient-portal" style={{ display: "inline-block", background: "#3b7fc4", color: "#fff", textDecoration: "none", padding: "11px 22px", borderRadius: 10, fontWeight: 700, fontSize: 14 }}>Go to your portal</Link>
      </div>
    </div>
  );
}
