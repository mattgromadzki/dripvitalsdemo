"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { useAuth } from "@/lib/hooks/useAuth";

export default function ForgotPasswordPage() {
  const requestReset = useAuth((s) => s.requestReset);
  const accountExists = useAuth((s) => s.accountExists);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  function submit() {
    requestReset(email);
    setSent(true);
  }

  if (sent) {
    const exists = accountExists(email);
    return (
      <AuthShell title="Check your email" subtitle="Password reset requested">
        <p className="text-[13px] text-ink-muted leading-relaxed mb-4">
          If an account exists for <b className="text-ink">{email || "that address"}</b>, we&apos;ve sent a link to reset your password.
        </p>
        <div className="px-3 py-2.5 rounded-lg bg-amber-soft text-[11.5px] text-amber leading-relaxed mb-4">
          ⚠ This is a demo — no real email is sent. {exists
            ? <>Use the link below to set a new password.</>
            : <>No demo account matches that email, but you can still try the reset screen.</>}
        </div>
        <Link href={`/reset-password?email=${encodeURIComponent(email)}`} className="btn btn-primary w-full text-center">Continue to reset →</Link>
        <Link href="/login" className="block text-center text-[12px] text-brand font-medium mt-3">← Back to sign in</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Forgot password" subtitle="We'll send you a reset link">
      <label className="fl">Email</label>
      <input className="fi mb-4" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="you@dripvitals.com" />
      <button className="btn btn-primary w-full" onClick={submit}>Send reset link</button>
      <Link href="/login" className="block text-center text-[12px] text-brand font-medium mt-3">← Back to sign in</Link>
    </AuthShell>
  );
}
