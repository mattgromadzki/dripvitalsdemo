"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { useAuth } from "@/lib/hooks/useAuth";

export default function ResetPasswordPage() {
  const resetPassword = useAuth((s) => s.resetPassword);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [welcome, setWelcome] = useState(false);

  // Read ?token= and ?email= from the URL (avoids useSearchParams Suspense requirement).
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const e = p.get("email"); if (e) setEmail(e);
      const t = p.get("token"); if (t) setToken(t);
      if (p.get("welcome")) setWelcome(true);
    } catch { /* ignore */ }
  }, []);

  async function submit() {
    if (pw.length < 8) { setErr("Password must be at least 8 characters."); return; }
    if (pw !== pw2) { setErr("Passwords don't match."); return; }
    const res = await resetPassword(email, pw, token);
    if (!res.ok) { setErr(res.error || "Could not reset password."); return; }
    setErr(null);
    setDone(true);
  }

  if (done) {
    return (
      <AuthShell title="Password updated" subtitle="You can now sign in">
        <p className="text-[13px] text-ink-muted mb-4">Your password for <b className="text-ink">{email}</b> has been updated.</p>
        <Link href="/login" className="btn btn-primary w-full text-center">Go to sign in →</Link>
      </AuthShell>
    );
  }

  if (!token) {
    return (
      <AuthShell title="Reset link required" subtitle="This page needs a valid reset link">
        <p className="text-[13px] text-ink-muted leading-relaxed mb-4">Open the password-reset link from your email to continue. Reset links expire after 30 minutes.</p>
        <Link href="/forgot-password" className="btn btn-primary w-full text-center">Request a reset link →</Link>
        <Link href="/login" className="block text-center text-[12px] text-brand font-medium mt-3">← Back to sign in</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={welcome ? "Welcome to DripVitals" : "Set a new password"} subtitle={welcome ? "Set your password to activate your account" : "Choose a new password for your account"}>
      {err && <div className="mb-3 px-3 py-2 rounded-md bg-red-soft text-red text-[12.5px] font-medium">{err}</div>}
      <label className="fl">Email</label>
      <input className="fi mb-3" type="email" value={email} readOnly placeholder="you@dripvitals.com" />
      <label className="fl">New password</label>
      <input className="fi mb-3" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 8 characters" />
      <label className="fl">Confirm password</label>
      <input className="fi mb-4" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Re-enter password" />
      <button className="btn btn-primary w-full" onClick={submit}>Update password</button>
      <Link href="/login" className="block text-center text-[12px] text-brand font-medium mt-3">← Back to sign in</Link>
    </AuthShell>
  );
}
