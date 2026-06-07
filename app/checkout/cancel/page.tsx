import Link from "next/link";

export default async function CheckoutCancelPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const failed = status === "failed";
  return (
    <div style={{ minHeight: "100vh", background: "#f5f7fb", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ maxWidth: 460, width: "100%", background: "#fff", border: "1px solid #e6e9ef", borderRadius: 18, padding: "36px 32px", textAlign: "center" }}>
        <div style={{ fontSize: 46 }}>{failed ? "⚠️" : "↩️"}</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "10px 0 6px", color: "#15181c" }}>
          {failed ? "Payment couldn't be completed" : "Checkout canceled"}
        </h1>
        <p style={{ fontSize: 14.5, color: "#475467", lineHeight: 1.6, margin: "0 0 22px" }}>
          {failed
            ? "Your card wasn't charged. This can happen if the card was declined or the details didn't match — you can try again with the same or a different card."
            : "No payment was taken. Your information is saved — you can complete checkout whenever you're ready."}
        </p>
        <Link href="/patient-portal" style={{ display: "inline-block", background: "#3b7fc4", color: "#fff", textDecoration: "none", padding: "11px 22px", borderRadius: 10, fontWeight: 700, fontSize: 14 }}>Return to your portal</Link>
      </div>
    </div>
  );
}
