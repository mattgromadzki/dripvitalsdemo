"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { useAuth } from "@/lib/hooks/useAuth";

export default function ForgotPasswordPage() {
  const requestReset = useAuth((s) => s.requestReset);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const res = await requestReset(email);
    setDevLink(res.devLink);
    setSent(true);
    setBusy(false);
  }

  if (sent) {
    return (
      <AuthShell title="Check your email" subtitle="Password reset requested">
        <p className="text-[13px] text-ink-muted leading-relaxed mb-4">
          If an account exists for <b className="text-ink">{email || "that address"}</b>, we&apos;ve sent a one-time link to reset your password. It expires in 30 minutes.
        </p>
        {devLink ? (
          <>
            <div className="px-3 py-2.5 rounded-lg bg-amber-soft text-[11.5px] text-amber leading-relaxed mb-4">
              ⚠ Email isn&apos;t configured in this environment, so here&apos;s your one-time reset link directly. In production this is emailed instead.
            </div>
            <Link href={devLink} className="btn btn-primary w-full text-center">Continue to reset →</Link>
          </>
        ) : (
          <div className="px-3 py-2.5 rounded-lg bg-surface-2 text-[11.5px] text-ink-muted leading-relaxed mb-4">
            Open the link in that email to choose a new password. Didn&apos;t get it? Check spam, or try again in a minute.
          </div>
        )}
        <Link href="/login" className="block text-center text-[12px] text-brand font-medium mt-3">← Back to sign in</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Forgot password" subtitle="We'll send you a reset link">
      <label className="fl">Email</label>
      <input className="fi mb-4" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="you@dripvitals.com" />
      <button className="btn btn-primary w-full" onClick={submit} disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
      <Link href="/login" className="block text-center text-[12px] text-brand font-medium mt-3">← Back to sign in</Link>
    </AuthShell>
  );
}
