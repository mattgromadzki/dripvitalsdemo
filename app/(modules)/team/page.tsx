"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { usePermission } from "@/lib/rbac/usePermission";
import { ROLES } from "@/lib/rbac/permissions";
import { toast } from "@/lib/hooks/useToast";
import { Toast } from "@/components/ui/Toast";
import { useDoctors } from "@/lib/hooks/useDoctors";
import type { Doctor } from "@/lib/types";

interface Acct { email: string; name: string; role: string; active: boolean; twofa?: boolean; locked?: boolean; }
const roleLabel = (id: string) => ROLES.find((r) => r.id === id)?.label || id;

// Build a starter doctor profile from a new provider account. NPI and licenses
// are left blank for the admin to fill in (those can't be auto-generated).
function makeDoctorStub(name: string, email: string): Omit<Doctor, "id"> {
  const clean = name.trim().replace(/^\s*(dr\.?|mr\.?|mrs\.?|ms\.?)\s+/i, "");
  const parts = clean.split(/\s+/).filter(Boolean);
  const first = parts[0] || clean || "New";
  const last = parts.length > 1 ? parts.slice(1).join(" ") : "";
  return {
    first, last, middle: "", title: "MD", role: "Associate Physician",
    email: email.trim(), phone: "", npi: "",
    yearsExperience: 0, specialties: [],
    active: true, epcs: false, surescripts: false, onCall: false, acceptingNew: true,
    patients: 0, color: "var(--color-brand)", licenses: [],
  };
}

export default function TeamPage() {
  const canManage = usePermission("users.manage");
  const me = useAuth((s) => s.user?.email)?.toLowerCase();
  const addDoctor = useDoctors((s) => s.add);
  const doctors = useDoctors((s) => s.doctors);

  const [accts, setAccts] = useState<Acct[]>([]);
  const [loading, setLoading] = useState(true);
  const [persistent, setPersistent] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("support");
  const [pw, setPw] = useState("");
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/auth/accounts", { cache: "no-store" });
      const d = await r.json();
      if (d?.ok) { setAccts(d.accounts || []); }
      const h = await fetch("/api/store/medications", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
      if (h) setPersistent(!!h.persistent);
    } catch { /* ignore */ }
    setLoading(false);
  }
  useEffect(() => { if (canManage) load(); else setLoading(false); }, [canManage]);

  async function post(body: Record<string, unknown>, okMsg: string) {
    const r = await fetch("/api/auth/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json();
    if (d?.ok) { toast(okMsg); await load(); return true; }
    toast("⚠️ " + (d?.error || "Action failed")); return false;
  }

  async function addMember() {
    const isProvider = role === "provider";
    if (await post({ action: "create", name, email, role, password: pw }, "✓ Team member added")) {
      if (isProvider && !doctors.some((d) => d.email.trim().toLowerCase() === email.trim().toLowerCase())) {
        addDoctor(makeDoctorStub(name, email));
        toast("✓ Doctor profile created — add their NPI & licenses in Doctors");
      }
      setName(""); setEmail(""); setPw(""); setRole("support");
    }
  }

  async function inviteMember() {
    if (!name.trim() || !email.includes("@")) { toast("⚠️ Enter a name and a valid email first"); return; }
    const r = await fetch("/api/auth/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "invite", name, email, role }) });
    const d = await r.json().catch(() => null);
    if (!d?.ok) { toast("⚠️ " + (d?.error || "Could not send invite")); return; }
    if (role === "provider" && !doctors.some((x) => x.email.trim().toLowerCase() === email.trim().toLowerCase())) {
      addDoctor(makeDoctorStub(name, email));
      toast("✓ Doctor profile created — add their NPI & licenses in Doctors");
    }
    if (d.devLink) {
      try { await navigator.clipboard.writeText(d.devLink); toast("🔗 No email provider set — set-password link copied to clipboard"); }
      catch { toast("Invite created — set-password link: " + d.devLink); }
    } else {
      toast("✉️ Invite sent — they'll get a link to set their password");
    }
    setName(""); setEmail(""); setPw(""); setRole("support");
    await load();
  }

  if (!canManage) {
    return (
      <div className="px-7 py-6">
        <div className="bg-surface border border-border rounded-lg p-12 text-center">
          <div className="text-[36px] opacity-40 mb-2">🔐</div>
          <div className="text-[14px] font-bold mb-1">No access</div>
          <div className="text-[12px] text-ink-muted">You need the “Manage users &amp; roles” permission to view the team.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-7 py-6 text-[14px]">
      <div className="mb-4">
        <h1 className="text-[21px] font-extrabold tracking-tight">Team</h1>
        <div className="text-[12px] text-ink-muted mt-0.5">Create staff accounts, change roles, reset passwords, and disable access. Roles control what each person can see and do.</div>
      </div>

      {!persistent && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-amber-soft text-amber border border-border text-[12.5px]">
          Connect Upstash to persist accounts. Without it, the seeded demo accounts work but anyone you add here resets on redeploy.
        </div>
      )}

      {/* Add member */}
      <div className="bg-surface border border-border rounded-xl p-4 mb-5">
        <div className="text-[13px] font-bold mb-3">Add team member</div>
        <div className="grid grid-cols-[1.3fr_1.6fr_1fr_1.1fr_auto] gap-2 items-end max-[900px]:grid-cols-1">
          <div><label className="fl">Name</label><input className="fi" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Jane Doe" /></div>
          <div><label className="fl">Email</label><input className="fi" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@dripvitals.com" /></div>
          <div><label className="fl">Role</label>
            <select className="fsel" value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
          <div><label className="fl">Temp password <span className="text-ink-muted-2 font-normal">(optional)</span></label><input className="fi" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="min 8 chars" /></div>
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={addMember}>Add</button>
            <button className="btn btn-secondary whitespace-nowrap" onClick={inviteMember} title="Create the account and email them a link to set their own password">✉️ Invite</button>
          </div>
        </div>
        <div className="text-[11.5px] text-ink-muted mt-2">Enter a temporary password and click <b>Add</b>, or leave it blank and click <b>Invite</b> to email a one-time set-password link (no shared password).</div>
      </div>

      {/* Member list */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-[2fr_1.3fr_1fr_auto] gap-2 px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-wide text-ink-muted border-b border-border">
          <div>Member</div><div>Role</div><div>Status</div><div className="text-right">Actions</div>
        </div>
        {loading ? (
          <div className="px-4 py-8 text-center text-ink-muted text-[12.5px]">Loading…</div>
        ) : accts.length === 0 ? (
          <div className="px-4 py-8 text-center text-ink-muted text-[12.5px]">No accounts yet.</div>
        ) : accts.map((a) => (
          <div key={a.email} className="border-b border-border last:border-0">
            <div className="grid grid-cols-[2fr_1.3fr_1fr_auto] gap-2 px-4 py-3 items-center">
              <div>
                <div className="font-semibold text-ink">{a.name} {a.email === me && <span className="text-ink-muted-2 font-normal">(you)</span>}</div>
                <div className="text-[12px] text-ink-muted font-mono">{a.email}</div>
              </div>
              <div>
                <select className="fsel" value={a.role} disabled={a.email === me} onChange={(e) => post({ action: "role", email: a.email, role: e.target.value }, "✓ Role updated")}>
                  {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {a.active
                  ? <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-soft text-green">Active</span>
                  : <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-soft text-red">Disabled</span>}
                {a.twofa && <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-brand/10 text-brand">🔐 2FA</span>}
                {a.locked && <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-soft text-amber">Locked</span>}
              </div>
              <div className="flex gap-2 justify-end">
                <button className="btn btn-ghost btn-sm" onClick={() => { setResetFor(resetFor === a.email ? null : a.email); setResetPw(""); }}>Reset password</button>
                {a.locked && (
                  <button className="btn btn-ghost btn-sm" style={{ color: "var(--color-amber)" }}
                    onClick={() => post({ action: "unlock", email: a.email }, "✓ Account unlocked")}>Unlock</button>
                )}
                {a.twofa && a.email !== me && (
                  <button className="btn btn-ghost btn-sm" onClick={() => post({ action: "disable2fa", email: a.email }, "✓ 2FA reset for user")}>Reset 2FA</button>
                )}
                {a.email !== me && (
                  <button className="btn btn-ghost btn-sm" style={{ color: a.active ? "var(--color-red)" : "var(--color-green)" }}
                    onClick={() => post({ action: "active", email: a.email, active: !a.active }, a.active ? "✓ Account disabled" : "✓ Account enabled")}>
                    {a.active ? "Disable" : "Enable"}
                  </button>
                )}
              </div>
            </div>
            {resetFor === a.email && (
              <div className="px-4 pb-3 flex gap-2 items-center">
                <input className="fi" style={{ maxWidth: 260 }} value={resetPw} onChange={(e) => setResetPw(e.target.value)} placeholder="New password (min 8)" />
                <button className="btn btn-primary btn-sm" onClick={async () => { if (await post({ action: "reset", email: a.email, password: resetPw }, "✓ Password reset")) { setResetFor(null); setResetPw(""); } }}>Save</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setResetFor(null)}>Cancel</button>
              </div>
            )}
          </div>
        ))}
      </div>
      <Toast />
    </div>
  );
}
