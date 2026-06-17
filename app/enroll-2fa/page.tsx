"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { useAuth } from "@/lib/hooks/useAuth";

type Step = "loading" | "setup" | "backup";

export default function EnrollTwoFactorPage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const hydrated = useAuth((s) => s.hydrated);
  const mustEnroll = useAuth((s) => s.mustEnroll);
  const hydrate = useAuth((s) => s.hydrate);

  const [step, setStep] = useState<Step>("loading");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { hydrate(); }, [hydrate]);

  // Send users who don't belong here back where they should be.
  useEffect(() => {
    if (!hydrated) return;
    if (!user) { router.replace("/login"); return; }
    if (!mustEnroll) { router.replace("/dashboard"); return; }
  }, [hydrated, user, mustEnroll, router]);

  // Kick off enrollment once we know the user must enroll.
  useEffect(() => {
    if (!hydrated || !user || !mustEnroll || step !== "loading") return;
    (async () => {
      try {
        const r = await fetch("/api/auth/2fa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "begin" }) });
        const d = await r.json();
        if (d?.ok) { setQr(d.qr); setSecret(d.secret); setStep("setup"); }
        else setErr(d?.error || "Could not start setup.");
      } catch { setErr("Network error — please try again."); }
    })();
  }, [hydrated, user, mustEnroll, step]);

  async function confirm() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/auth/2fa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "confirm", code: code.trim() }) });
      const d = await r.json();
      if (d?.ok) { setBackup(d.backupCodes || []); setStep("backup"); }
      else { setErr(d?.error || "That code didn't match."); setBusy(false); }
    } catch { setErr("Network error — please try again."); setBusy(false); }
  }

  async function finish() {
    await hydrate();           // session now carries twofa:true → gate releases
    router.replace("/dashboard");
  }

  if (!hydrated || step === "loading") {
    return <AuthShell title="Set up two-factor" subtitle="Loading…"><div className="text-[12.5px] text-ink-muted">{err || "Preparing your authenticator setup…"}</div></AuthShell>;
  }

  if (step === "backup") {
    return (
      <AuthShell title="Save your backup codes" subtitle="Store these somewhere safe — each works once if you lose your authenticator.">
        <div className="grid grid-cols-2 gap-2 mb-4">
          {backup.map((c) => <div key={c} className="px-2 py-1.5 rounded-md bg-surface-3 text-center font-mono text-[12.5px] tracking-wide">{c}</div>)}
        </div>
        <button className="btn btn-ghost w-full mb-2" onClick={() => navigator.clipboard?.writeText(backup.join("\n"))}>Copy codes</button>
        <button className="btn btn-primary w-full" onClick={finish}>I've saved them — continue</button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Set up two-factor authentication" subtitle={`Required for ${user?.email || "your account"}. Scan the code with an authenticator app (Google Authenticator, Authy, 1Password).`}>
      {err && <div className="mb-3 px-3 py-2 rounded-md bg-red-soft text-red text-[12.5px] font-medium">{err}</div>}
      {qr && <div className="flex justify-center mb-3"><img src={qr} alt="2FA QR code" width={200} height={200} style={{ borderRadius: 8 }} /></div>}
      <div className="text-[11px] text-ink-muted-2 text-center mb-4 break-all">Can't scan? Enter this key: <span className="font-mono text-ink-muted">{secret}</span></div>
      <label className="fl">Enter the 6-digit code</label>
      <input className="fi mb-4" inputMode="numeric" autoFocus value={code} autoComplete="one-time-code" onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && confirm()} placeholder="123 456" />
      <button className="btn btn-primary w-full" onClick={confirm} disabled={busy || code.trim().length < 6}>{busy ? "Verifying…" : "Verify & enable"}</button>
    </AuthShell>
  );
}
