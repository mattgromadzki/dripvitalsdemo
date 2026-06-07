"use client";

import { useEffect, useState } from "react";
import { toast } from "@/lib/hooks/useToast";

type Status = "loading" | "off" | "on";

export function TwoFactorCard() {
  const [status, setStatus] = useState<Status>("loading");
  const [step, setStep] = useState<"idle" | "setup">("idle");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [showDisable, setShowDisable] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    try {
      const d = await (await fetch("/api/auth/2fa", { cache: "no-store" })).json();
      setStatus(d?.enabled ? "on" : "off");
    } catch { setStatus("off"); }
  }
  useEffect(() => { refresh(); }, []);

  async function begin() {
    setBusy(true); setErr(null);
    try {
      const d = await (await fetch("/api/auth/2fa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "begin" }) })).json();
      if (d?.ok) { setQr(d.qr); setSecret(d.secret); setStep("setup"); setCode(""); }
      else setErr(d?.error || "Could not start setup.");
    } catch { setErr("Network error."); } finally { setBusy(false); }
  }

  async function confirm() {
    setBusy(true); setErr(null);
    try {
      const d = await (await fetch("/api/auth/2fa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "confirm", code }) })).json();
      if (d?.ok) { setBackupCodes(d.backupCodes || []); setStep("idle"); setStatus("on"); toast("✓ Two-factor authentication enabled"); }
      else setErr(d?.error || "That code didn't match.");
    } catch { setErr("Network error."); } finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true); setErr(null);
    try {
      const d = await (await fetch("/api/auth/2fa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "disable", code: disableCode }) })).json();
      if (d?.ok) { setStatus("off"); setShowDisable(false); setDisableCode(""); setBackupCodes(null); toast("Two-factor authentication turned off"); }
      else setErr(d?.error || "Could not turn off 2FA.");
    } catch { setErr("Network error."); } finally { setBusy(false); }
  }

  return (
    <div className="border border-border rounded-lg p-4 bg-surface">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[13.5px] font-bold text-ink flex items-center gap-2">
            🔐 My two-factor authentication
            {status === "on" && <span className="text-[10.5px] font-bold text-green bg-green-soft px-1.5 py-0.5 rounded">ON</span>}
            {status === "off" && <span className="text-[10.5px] font-bold text-amber bg-amber-soft px-1.5 py-0.5 rounded">OFF</span>}
          </div>
          <div className="text-[12px] text-ink-muted mt-0.5">Protects your own sign-in with an authenticator app (TOTP). This is separate from the org-wide policy toggle below.</div>
        </div>
        {status === "off" && step === "idle" && <button className="btn btn-primary btn-sm whitespace-nowrap" onClick={begin} disabled={busy}>{busy ? "…" : "Enable 2FA"}</button>}
        {status === "on" && !showDisable && <button className="btn btn-ghost btn-sm whitespace-nowrap" onClick={() => { setShowDisable(true); setErr(null); }}>Turn off</button>}
      </div>

      {err && <div className="mt-3 px-3 py-2 rounded-md bg-red-soft text-red text-[12px] font-medium">{err}</div>}

      {step === "setup" && (
        <div className="mt-4 grid grid-cols-[auto_1fr] gap-4 max-[640px]:grid-cols-1 items-start">
          {qr && <img src={qr} alt="2FA QR code" width={180} height={180} className="rounded-md border border-border bg-white p-1" />}
          <div>
            <div className="text-[12.5px] text-ink-2 leading-relaxed mb-2">
              1. Scan the QR code with Google Authenticator, Authy, or 1Password.<br />
              Or enter this key manually: <code className="text-[11.5px] bg-surface-2 px-1.5 py-0.5 rounded break-all">{secret}</code>
            </div>
            <label className="fl">2. Enter the 6-digit code to confirm</label>
            <input className="fi mb-2" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && confirm()} placeholder="123 456" style={{ maxWidth: 220 }} />
            <div className="flex gap-2">
              <button className="btn btn-primary btn-sm" onClick={confirm} disabled={busy}>{busy ? "Verifying…" : "Confirm & enable"}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setStep("idle"); setErr(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {backupCodes && (
        <div className="mt-4 border border-amber/40 bg-amber-soft rounded-md p-3">
          <div className="text-[12.5px] font-bold text-amber mb-1">Save your backup codes</div>
          <div className="text-[11.5px] text-ink-2 mb-2">Each code works once if you lose your authenticator. Store them somewhere safe — they won&apos;t be shown again.</div>
          <div className="grid grid-cols-2 gap-1.5 font-mono text-[12.5px] text-ink-2">
            {backupCodes.map((c) => <div key={c} className="bg-surface px-2 py-1 rounded border border-border text-center">{c}</div>)}
          </div>
          <button className="btn btn-ghost btn-sm mt-2" onClick={() => { navigator.clipboard?.writeText(backupCodes.join("\n")); toast("Backup codes copied"); }}>Copy codes</button>
        </div>
      )}

      {showDisable && (
        <div className="mt-4 border border-border rounded-md p-3">
          <div className="text-[12.5px] text-ink-2 mb-2">Enter a current authenticator code (or a backup code) to turn off 2FA.</div>
          <div className="flex gap-2 items-center flex-wrap">
            <input className="fi" value={disableCode} onChange={(e) => setDisableCode(e.target.value)} placeholder="123 456" style={{ maxWidth: 200 }} />
            <button className="btn btn-primary btn-sm" onClick={disable} disabled={busy}>{busy ? "…" : "Turn off 2FA"}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowDisable(false); setErr(null); }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
