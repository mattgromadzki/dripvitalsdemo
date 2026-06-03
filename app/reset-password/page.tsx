"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { useAuth } from "@/lib/hooks/useAuth";

export default function ResetPasswordPage() {
  const resetPassword = useAuth((s) => s.resetPassword);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Read ?email= from the URL on the client (avoids useSearchParams Suspense requirement)
  useEffect(() => {
    try { const p = new URLSearchParams(window.location.search); const e = p.get("email"); if (e) setEmail(e); } catch { /* ignore */ }
  }, []);

  function submit() {
    if (pw !== pw2) { setErr("Passwords don't match."); return; }
    const res = resetPassword(email, pw);
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

  return (
    <AuthShell title="Set a new password" subtitle="Choose a new password for your account">
      {err && <div className="mb-3 px-3 py-2 rounded-md bg-red-soft text-red text-[12.5px] font-medium">{err}</div>}
      <label className="fl">Email</label>
      <input className="fi mb-3" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@dripvitals.com" />
      <label className="fl">New password</label>
      <input className="fi mb-3" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 6 characters" />
      <label className="fl">Confirm password</label>
      <input className="fi mb-4" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Re-enter password" />
      <button className="btn btn-primary w-full" onClick={submit}>Update password</button>
      <Link href="/login" className="block text-center text-[12px] text-brand font-medium mt-3">← Back to sign in</Link>
    </AuthShell>
  );
}
