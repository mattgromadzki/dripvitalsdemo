"use client";

import { useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { toast } from "@/lib/hooks/useToast";
import { useStaff } from "@/lib/hooks/useStaff";
import { useIntegrations } from "@/lib/hooks/useIntegrations";
import { TwoFactorCard } from "@/components/settings/TwoFactorCard";

type Tab = "practice" | "branding" | "team" | "notifications" | "security" | "compliance" | "danger";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "practice",      label: "Practice Profile",  icon: "🏥" },
  { id: "branding",      label: "Branding",          icon: "🎨" },
  { id: "team",          label: "Team & Roles",      icon: "👥" },
  { id: "notifications", label: "Notifications",     icon: "🔔" },
  { id: "security",      label: "Security & SSO",    icon: "🛡" },
  { id: "compliance",    label: "Compliance",        icon: "📋" },
  { id: "danger",        label: "Danger Zone",       icon: "⚠" },
];

export default function SettingsPage() {
  const staff = useStaff((s) => s.staff);
  const integrations = useIntegrations((s) => s.integrations);

  const [tab, setTab] = useState<Tab>("practice");

  // ── Practice profile state ────────────────────────────────────────────
  const [practice, setPractice] = useState({
    name: "DripVitals Health",
    legalName: "DripVitals Health LLC",
    npi: "1023456999",
    ein: "92-1234567",
    phone: "(305) 555-0100",
    email: "hello@dripvitals.health",
    website: "https://dripvitals.com",
    addressStreet: "2100 Biscayne Blvd, Suite 1200",
    addressCity: "Miami",
    addressState: "FL",
    addressZip: "33137",
    timezone: "America/New_York",
    hoursWeekday: "8:00 AM – 7:00 PM",
    hoursWeekend: "9:00 AM – 4:00 PM (Sat) · Closed (Sun)",
  });

  // ── Branding ──────────────────────────────────────────────────────────
  const [branding, setBranding] = useState({
    primaryColor: "#4a8ec7",
    logoUrl: "/dripvitals-logo.png",
    favicon: "/favicon.ico",
    emailSignature: "Best,\nThe DripVitals Care Team\nhello@dripvitals.health · (305) 555-0100",
    portalDomain: "app.dripvitals.com",
    customCss: false,
  });

  // ── Notifications prefs ───────────────────────────────────────────────
  const [notifPrefs, setNotifPrefs] = useState({
    emailDigest: true,
    smsAlerts: true,
    pushNotifications: true,
    weeklyReport: true,
    monthlyBillingSummary: true,
    quietHoursEnabled: true,
    quietHoursStart: "21:00",
    quietHoursEnd: "07:00",
  });

  // ── Security ─────────────────────────────────────────────────────────
  const [security, setSecurity] = useState({
    require2FA: true,
    sessionTimeoutMinutes: 30,
    passwordExpiryDays: 90,
    minPasswordLength: 12,
    ssoEnabled: false,
    ssoProvider: "okta",
    ipAllowlist: false,
    failedLoginLock: 5,
  });

  // ── Compliance ────────────────────────────────────────────────────────
  const [compliance, setCompliance] = useState({
    hipaaMode: true,
    auditRetentionYears: 7,
    autoLogoutOnIdle: true,
    encryptAtRest: true,
    encryptInTransit: true,
    breachNotificationContact: "marcus@dripvitals.health",
    privacyOfficer: "Marcus Webb",
    requireBaaSign: true,
  });

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  function save(section: string) {
    toast(`💾 ${section} settings saved`);
  }

  // ── Field helpers ─────────────────────────────────────────────────────
  function setP<K extends keyof typeof practice>(key: K, val: typeof practice[K]) {
    setPractice((p) => ({ ...p, [key]: val }));
  }
  function setB<K extends keyof typeof branding>(key: K, val: typeof branding[K]) {
    setBranding((p) => ({ ...p, [key]: val }));
  }
  function setN<K extends keyof typeof notifPrefs>(key: K, val: typeof notifPrefs[K]) {
    setNotifPrefs((p) => ({ ...p, [key]: val }));
  }
  function setS<K extends keyof typeof security>(key: K, val: typeof security[K]) {
    setSecurity((p) => ({ ...p, [key]: val }));
  }
  function setC<K extends keyof typeof compliance>(key: K, val: typeof compliance[K]) {
    setCompliance((p) => ({ ...p, [key]: val }));
  }

  // Derived data
  const adminCount    = staff.filter((s) => s.role === "Admin").length;
  const providerCount = staff.filter((s) => s.role === "Provider (MD)" || s.role === "Provider (NP)").length;
  const otherCount    = staff.length - adminCount - providerCount;
  const connectedIntegrations = integrations.filter((i) => i.status === "connected").length;
  const monthlyIntegrationSpend = integrations.reduce((sum, i) => sum + (i.monthlySpend || 0), 0);

  return (
    <div className="px-7 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="text-[22px] font-bold tracking-tight text-ink mb-1">Settings</div>
          <div className="text-[13px] text-ink-muted">
            Manage practice profile, team, security, and compliance
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <Pill intent="green" dot>All settings synced</Pill>
        </div>
      </div>

      {/* 2-column layout: tab nav + content */}
      <div className="grid grid-cols-[240px_1fr] gap-5 max-[900px]:grid-cols-1">
        {/* Tab nav */}
        <nav className="bg-surface border border-border rounded-lg overflow-hidden h-fit sticky top-4">
          {TABS.map((t) => {
            const isDanger = t.id === "danger";
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={[
                  "w-full text-left py-2.5 px-3.5 flex items-center gap-2.5 text-[12.5px] font-medium transition-colors border-l-[2.5px]",
                  active
                    ? isDanger
                      ? "bg-red-soft text-red border-red font-semibold"
                      : "bg-brand-soft text-brand-dk border-brand font-semibold"
                    : isDanger
                      ? "text-red border-transparent hover:bg-red-soft"
                      : "text-ink-2 border-transparent hover:bg-surface-2",
                ].join(" ")}
              >
                <span className="text-[14px]">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div>
          {tab === "practice" && (
            <Card title="Practice Profile" icon="🏥" onSave={() => save("Practice Profile")}>
              <div className="space-y-4">
                <Section title="Identity">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Practice Name" required>
                      <input className="fi" value={practice.name} onChange={(e) => setP("name", e.target.value)} />
                    </Field>
                    <Field label="Legal Entity Name">
                      <input className="fi" value={practice.legalName} onChange={(e) => setP("legalName", e.target.value)} />
                    </Field>
                    <Field label="NPI">
                      <input className="fi font-mono" value={practice.npi} onChange={(e) => setP("npi", e.target.value)} />
                    </Field>
                    <Field label="EIN">
                      <input className="fi font-mono" value={practice.ein} onChange={(e) => setP("ein", e.target.value)} />
                    </Field>
                  </div>
                </Section>

                <Section title="Contact">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Phone">
                      <input className="fi" value={practice.phone} onChange={(e) => setP("phone", e.target.value)} />
                    </Field>
                    <Field label="Email">
                      <input className="fi" type="email" value={practice.email} onChange={(e) => setP("email", e.target.value)} />
                    </Field>
                    <Field label="Website" full>
                      <input className="fi" value={practice.website} onChange={(e) => setP("website", e.target.value)} />
                    </Field>
                  </div>
                </Section>

                <Section title="Address">
                  <div className="grid grid-cols-[1fr_140px_80px_120px] gap-3 max-[700px]:grid-cols-2">
                    <Field label="Street">
                      <input className="fi" value={practice.addressStreet} onChange={(e) => setP("addressStreet", e.target.value)} />
                    </Field>
                    <Field label="City">
                      <input className="fi" value={practice.addressCity} onChange={(e) => setP("addressCity", e.target.value)} />
                    </Field>
                    <Field label="State">
                      <input className="fi" value={practice.addressState} onChange={(e) => setP("addressState", e.target.value)} />
                    </Field>
                    <Field label="ZIP">
                      <input className="fi" value={practice.addressZip} onChange={(e) => setP("addressZip", e.target.value)} />
                    </Field>
                  </div>
                </Section>

                <Section title="Hours & Timezone">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Timezone">
                      <select className="fsel" value={practice.timezone} onChange={(e) => setP("timezone", e.target.value)}>
                        <option value="America/New_York">America/New_York (ET)</option>
                        <option value="America/Chicago">America/Chicago (CT)</option>
                        <option value="America/Denver">America/Denver (MT)</option>
                        <option value="America/Los_Angeles">America/Los_Angeles (PT)</option>
                      </select>
                    </Field>
                    <Field label="Weekday Hours">
                      <input className="fi" value={practice.hoursWeekday} onChange={(e) => setP("hoursWeekday", e.target.value)} />
                    </Field>
                    <Field label="Weekend Hours" full>
                      <input className="fi" value={practice.hoursWeekend} onChange={(e) => setP("hoursWeekend", e.target.value)} />
                    </Field>
                  </div>
                </Section>
              </div>
            </Card>
          )}

          {tab === "branding" && (
            <Card title="Branding & White-Label" icon="🎨" onSave={() => save("Branding")}>
              <div className="space-y-4">
                <Section title="Visual Identity">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-16 h-16 rounded-md border border-border flex items-center justify-center text-white text-[20px] font-bold flex-shrink-0"
                        style={{ background: branding.primaryColor }}
                      >
                        DV
                      </div>
                      <div className="flex-1">
                        <div className="text-[12.5px] font-bold mb-1">Logo</div>
                        <div className="text-[11px] text-ink-muted mb-2">Recommended: 512×512px PNG with transparent background</div>
                        <div className="flex gap-2">
                          <button className="btn btn-ghost btn-sm" onClick={() => toast("📤 Logo uploader opened")}>📤 Upload Logo</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => toast("🗑 Logo reset to default")}>Reset</button>
                        </div>
                      </div>
                    </div>

                    <Field label="Primary Brand Color">
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={branding.primaryColor}
                          onChange={(e) => setB("primaryColor", e.target.value)}
                          className="w-12 h-10 rounded border border-border cursor-pointer"
                        />
                        <input
                          className="fi font-mono"
                          value={branding.primaryColor}
                          onChange={(e) => setB("primaryColor", e.target.value)}
                          style={{ flex: 1 }}
                        />
                      </div>
                    </Field>
                  </div>
                </Section>

                <Section title="Patient-Facing">
                  <div className="space-y-3">
                    <Field label="Portal Domain">
                      <div className="flex items-center gap-2">
                        <input className="fi font-mono" value={branding.portalDomain} onChange={(e) => setB("portalDomain", e.target.value)} />
                        <Pill intent="green" dot>SSL Active</Pill>
                      </div>
                    </Field>
                    <Field label="Default Email Signature">
                      <textarea className="fta" rows={4} value={branding.emailSignature} onChange={(e) => setB("emailSignature", e.target.value)} />
                    </Field>
                    <ToggleRow
                      label="Custom CSS for patient portal"
                      description="Lets you override portal styles with custom CSS. Advanced — requires technical review."
                      checked={branding.customCss}
                      onChange={(v) => setB("customCss", v)}
                    />
                  </div>
                </Section>
              </div>
            </Card>
          )}

          {tab === "team" && (
            <Card title="Team & Roles" icon="👥" onSave={() => save("Team")}>
              <div className="space-y-4">
                <Section title="Team Summary">
                  <div className="grid grid-cols-4 gap-2 max-[600px]:grid-cols-2">
                    <StatBox label="Total Members" value={staff.length.toString()} color="var(--color-brand)" />
                    <StatBox label="Admins"        value={adminCount.toString()}    color="var(--color-red)" />
                    <StatBox label="Providers"     value={providerCount.toString()} color="var(--color-violet)" />
                    <StatBox label="Other Staff"   value={otherCount.toString()}    color="var(--color-amber)" />
                  </div>
                  <div className="text-[11.5px] text-ink-muted mt-3">
                    Full team management (invite, deactivate, edit permissions, license tracking) lives in the{" "}
                    <Link href="/staff" className="font-bold text-brand-dk hover:underline">Doctors &amp; Staff module</Link>.
                  </div>
                </Section>

                <Section title="Role Permissions Matrix">
                  <div className="bg-surface-2 border border-border rounded-md overflow-hidden">
                    <table className="w-full text-[11.5px]">
                      <thead>
                        <tr className="bg-surface-3">
                          <th className="text-left py-2 px-3 font-bold uppercase tracking-widest text-ink-muted">Capability</th>
                          <th className="py-2 px-3 font-bold text-center">Admin</th>
                          <th className="py-2 px-3 font-bold text-center">Provider</th>
                          <th className="py-2 px-3 font-bold text-center">Coord.</th>
                          <th className="py-2 px-3 font-bold text-center">Nurse</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { cap: "View patient charts",    a: true,  p: true,  c: true,  n: true  },
                          { cap: "Edit clinical records",  a: true,  p: true,  c: false, n: true  },
                          { cap: "Sign prescriptions",     a: false, p: true,  c: false, n: false },
                          { cap: "Order labs",             a: false, p: true,  c: false, n: true  },
                          { cap: "Sign SOAP notes",        a: false, p: true,  c: false, n: false },
                          { cap: "Manage billing",         a: true,  p: false, c: false, n: false },
                          { cap: "Invite team members",    a: true,  p: false, c: false, n: false },
                          { cap: "View analytics",         a: true,  p: true,  c: true,  n: false },
                          { cap: "System settings",        a: true,  p: false, c: false, n: false },
                        ].map((row, i) => (
                          <tr key={i} className="border-t border-border">
                            <td className="py-2 px-3 font-medium">{row.cap}</td>
                            <td className="py-2 px-3 text-center">{row.a ? <span className="text-green font-bold">✓</span> : <span className="text-ink-muted">—</span>}</td>
                            <td className="py-2 px-3 text-center">{row.p ? <span className="text-green font-bold">✓</span> : <span className="text-ink-muted">—</span>}</td>
                            <td className="py-2 px-3 text-center">{row.c ? <span className="text-green font-bold">✓</span> : <span className="text-ink-muted">—</span>}</td>
                            <td className="py-2 px-3 text-center">{row.n ? <span className="text-green font-bold">✓</span> : <span className="text-ink-muted">—</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              </div>
            </Card>
          )}

          {tab === "notifications" && (
            <Card title="Notification Preferences" icon="🔔" onSave={() => save("Notifications")}>
              <div className="space-y-4">
                <Section title="Delivery Channels">
                  <div className="space-y-2">
                    <ToggleRow
                      label="Email digest"
                      description="Daily summary of activity, sent at 8 AM in your timezone."
                      checked={notifPrefs.emailDigest}
                      onChange={(v) => setN("emailDigest", v)}
                    />
                    <ToggleRow
                      label="SMS alerts"
                      description="Critical alerts only (urgent visits, payment failures, security)."
                      checked={notifPrefs.smsAlerts}
                      onChange={(v) => setN("smsAlerts", v)}
                    />
                    <ToggleRow
                      label="Push notifications"
                      description="Browser push for desktop and mobile app."
                      checked={notifPrefs.pushNotifications}
                      onChange={(v) => setN("pushNotifications", v)}
                    />
                  </div>
                </Section>

                <Section title="Periodic Reports">
                  <div className="space-y-2">
                    <ToggleRow
                      label="Weekly performance report"
                      description="Patient outcomes, revenue, and key metrics, every Monday."
                      checked={notifPrefs.weeklyReport}
                      onChange={(v) => setN("weeklyReport", v)}
                    />
                    <ToggleRow
                      label="Monthly billing summary"
                      description="MRR, churn, payment failures — 1st of each month."
                      checked={notifPrefs.monthlyBillingSummary}
                      onChange={(v) => setN("monthlyBillingSummary", v)}
                    />
                  </div>
                </Section>

                <Section title="Quiet Hours">
                  <ToggleRow
                    label="Enable quiet hours"
                    description="Suppress non-urgent notifications during these hours."
                    checked={notifPrefs.quietHoursEnabled}
                    onChange={(v) => setN("quietHoursEnabled", v)}
                  />
                  {notifPrefs.quietHoursEnabled && (
                    <div className="grid grid-cols-2 gap-3 mt-3 pl-4 border-l-2 border-brand-soft">
                      <Field label="Start">
                        <input type="time" className="fi" value={notifPrefs.quietHoursStart} onChange={(e) => setN("quietHoursStart", e.target.value)} />
                      </Field>
                      <Field label="End">
                        <input type="time" className="fi" value={notifPrefs.quietHoursEnd} onChange={(e) => setN("quietHoursEnd", e.target.value)} />
                      </Field>
                    </div>
                  )}
                </Section>

                <div className="text-[11.5px] text-ink-muted bg-surface-2 border border-border rounded px-3 py-2 flex items-center gap-2">
                  <span className="text-[13px]">💡</span>
                  <span>
                    Fine-grained per-event rules live in the{" "}
                    <Link href="/notifications" className="font-bold text-brand-dk hover:underline">Notifications Center</Link>.
                  </span>
                </div>
              </div>
            </Card>
          )}

          {tab === "security" && (
            <Card title="Security & SSO" icon="🛡" onSave={() => save("Security")}>
              <div className="space-y-4">
                <TwoFactorCard />
                <Section title="Authentication">
                  <div className="space-y-2">
                    <ToggleRow
                      label="Require 2FA for all team members"
                      description="Authenticator app (TOTP) or SMS-based second factor."
                      checked={security.require2FA}
                      onChange={(v) => setS("require2FA", v)}
                    />
                    <ToggleRow
                      label="IP allowlist"
                      description="Restrict login to specified IP ranges. Recommended for office-only access."
                      checked={security.ipAllowlist}
                      onChange={(v) => setS("ipAllowlist", v)}
                    />
                  </div>
                </Section>

                <Section title="Session & Password Policy">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Session timeout (minutes)">
                      <input
                        type="number"
                        className="fi font-mono"
                        value={security.sessionTimeoutMinutes}
                        min={5}
                        max={480}
                        onChange={(e) => setS("sessionTimeoutMinutes", parseInt(e.target.value, 10) || 30)}
                      />
                    </Field>
                    <Field label="Password expiry (days)">
                      <input
                        type="number"
                        className="fi font-mono"
                        value={security.passwordExpiryDays}
                        min={30}
                        max={365}
                        onChange={(e) => setS("passwordExpiryDays", parseInt(e.target.value, 10) || 90)}
                      />
                    </Field>
                    <Field label="Minimum password length">
                      <input
                        type="number"
                        className="fi font-mono"
                        value={security.minPasswordLength}
                        min={8}
                        max={32}
                        onChange={(e) => setS("minPasswordLength", parseInt(e.target.value, 10) || 12)}
                      />
                    </Field>
                    <Field label="Lock account after failed logins">
                      <input
                        type="number"
                        className="fi font-mono"
                        value={security.failedLoginLock}
                        min={3}
                        max={10}
                        onChange={(e) => setS("failedLoginLock", parseInt(e.target.value, 10) || 5)}
                      />
                    </Field>
                  </div>
                </Section>

                <Section title="Single Sign-On (SSO)">
                  <ToggleRow
                    label="Enable SSO"
                    description="Allow team members to sign in with your identity provider."
                    checked={security.ssoEnabled}
                    onChange={(v) => setS("ssoEnabled", v)}
                  />
                  {security.ssoEnabled && (
                    <div className="mt-3 pl-4 border-l-2 border-brand-soft">
                      <Field label="Provider">
                        <select className="fsel" value={security.ssoProvider} onChange={(e) => setS("ssoProvider", e.target.value)}>
                          <option value="okta">Okta</option>
                          <option value="azure">Azure AD / Microsoft Entra</option>
                          <option value="google">Google Workspace</option>
                          <option value="jumpcloud">JumpCloud</option>
                          <option value="saml">Custom SAML 2.0</option>
                        </select>
                      </Field>
                      <div className="text-[11px] text-ink-muted mt-2">
                        💡 SSO is available on the Practice Plus plan. Configuration requires IT setup — see docs for SAML metadata exchange.
                      </div>
                    </div>
                  )}
                </Section>
              </div>
            </Card>
          )}

          {tab === "compliance" && (
            <Card title="Compliance & Privacy" icon="📋" onSave={() => save("Compliance")}>
              <div className="space-y-4">
                <div
                  className="rounded-md border border-green-soft py-3 px-4 flex items-center gap-3 mb-2"
                  style={{ background: "rgba(10,122,78,.04)" }}
                >
                  <span className="text-[20px]">🛡</span>
                  <div className="flex-1">
                    <div className="text-[13px] font-bold text-green">HIPAA Compliant</div>
                    <div className="text-[11.5px] text-ink-2">All required safeguards active · §164.308, §164.310, §164.312, §164.530</div>
                  </div>
                  <Pill intent="green" dot>Verified</Pill>
                </div>

                <Section title="Security Safeguards">
                  <div className="space-y-2">
                    <ToggleRow
                      label="HIPAA mode"
                      description="Enforces all required HIPAA controls. Cannot be disabled in production."
                      checked={compliance.hipaaMode}
                      onChange={(v) => setC("hipaaMode", v)}
                      disabled
                    />
                    <ToggleRow
                      label="Encrypt data at rest"
                      description="AES-256 encryption for stored PHI."
                      checked={compliance.encryptAtRest}
                      onChange={(v) => setC("encryptAtRest", v)}
                      disabled
                    />
                    <ToggleRow
                      label="Encrypt data in transit"
                      description="TLS 1.3 minimum for all API and portal traffic."
                      checked={compliance.encryptInTransit}
                      onChange={(v) => setC("encryptInTransit", v)}
                      disabled
                    />
                    <ToggleRow
                      label="Auto-logout on idle"
                      description="Required for HIPAA workstation security."
                      checked={compliance.autoLogoutOnIdle}
                      onChange={(v) => setC("autoLogoutOnIdle", v)}
                    />
                    <ToggleRow
                      label="Require signed BAA from all vendors"
                      description="Blocks any integration that doesn't have a Business Associate Agreement on file."
                      checked={compliance.requireBaaSign}
                      onChange={(v) => setC("requireBaaSign", v)}
                    />
                  </div>
                </Section>

                <Section title="Retention & Officers">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Audit log retention (years)">
                      <input
                        type="number"
                        className="fi font-mono"
                        value={compliance.auditRetentionYears}
                        min={6}
                        onChange={(e) => setC("auditRetentionYears", parseInt(e.target.value, 10) || 7)}
                      />
                    </Field>
                    <Field label="Privacy Officer">
                      <input
                        className="fi"
                        value={compliance.privacyOfficer}
                        onChange={(e) => setC("privacyOfficer", e.target.value)}
                      />
                    </Field>
                    <Field label="Breach notification contact" full>
                      <input
                        className="fi"
                        type="email"
                        value={compliance.breachNotificationContact}
                        onChange={(e) => setC("breachNotificationContact", e.target.value)}
                      />
                    </Field>
                  </div>
                </Section>

                <Section title="Documentation">
                  <div className="grid grid-cols-3 gap-2 max-[700px]:grid-cols-2 max-[500px]:grid-cols-1">
                    {[
                      { label: "HIPAA BAA", desc: "Business Associate Agreement" },
                      { label: "Security Policy", desc: "164.308 administrative" },
                      { label: "Risk Assessment", desc: "Latest Q1 2026" },
                      { label: "Incident Response Plan", desc: "Updated Feb 2026" },
                      { label: "Privacy Notice", desc: "Patient-facing" },
                      { label: "SOC 2 Type II Report", desc: "Auditor-signed" },
                    ].map((doc) => (
                      <button
                        key={doc.label}
                        className="bg-surface-2 border border-border rounded-md p-2.5 text-left hover:border-border-2 transition-colors"
                        onClick={() => toast(`📥 Downloading ${doc.label}…`)}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[14px]">📄</span>
                          <div className="text-[11.5px] font-bold text-ink truncate">{doc.label}</div>
                        </div>
                        <div className="text-[10px] text-ink-muted ml-6">{doc.desc}</div>
                      </button>
                    ))}
                  </div>
                </Section>

                <div className="text-[11.5px] text-ink-muted bg-surface-2 border border-border rounded px-3 py-2 flex items-center gap-2">
                  <span className="text-[13px]">📋</span>
                  <span>
                    Activity audit trail is available in the{" "}
                    <Link href="/audit-log" className="font-bold text-brand-dk hover:underline">Audit Log module</Link>.
                  </span>
                </div>
              </div>
            </Card>
          )}

          {tab === "danger" && (
            <div className="bg-surface border-2 border-red-soft rounded-lg overflow-hidden">
              <div className="py-3 px-5 bg-red-soft border-b border-red-soft flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md flex items-center justify-center text-[14px] bg-red text-white flex-shrink-0">
                  ⚠
                </div>
                <div className="text-[13px] font-bold uppercase tracking-wider text-red">Danger Zone</div>
              </div>
              <div className="p-5 space-y-4">
                <div className="text-[12px] text-ink-2">
                  These actions are <strong>irreversible</strong>. Read carefully before proceeding.
                </div>

                <div className="border border-border rounded-md p-4 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-[260px]">
                    <div className="text-[13px] font-bold mb-1">Export all practice data</div>
                    <div className="text-[11.5px] text-ink-muted">
                      Downloads a ZIP archive of all patient records, billing data, and audit logs. May take up to 24 hours for large practices.
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => toast("📥 Export queued · You'll receive an email when ready")}>
                    📥 Request Export
                  </button>
                </div>

                <div className="border border-border rounded-md p-4 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-[260px]">
                    <div className="text-[13px] font-bold mb-1">Transfer ownership</div>
                    <div className="text-[11.5px] text-ink-muted">
                      Reassign the owner role to another admin. Current owner becomes admin. Requires the new owner to accept via email.
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => toast("✉ Transfer flow opened")}>
                    Transfer
                  </button>
                </div>

                <div className="border border-red rounded-md p-4 flex items-center gap-3 flex-wrap" style={{ background: "rgba(192,57,43,.03)" }}>
                  <div className="flex-1 min-w-[260px]">
                    <div className="text-[13px] font-bold text-red mb-1">Delete practice</div>
                    <div className="text-[11.5px] text-ink-2">
                      Permanently delete this practice and all associated data. Patient records will be archived per HIPAA 7-year retention before final deletion. <strong>This cannot be undone.</strong>
                    </div>
                  </div>
                  <button
                    className="px-3.5 py-2 rounded-md bg-red text-white text-[12px] font-bold hover:opacity-90 transition-opacity"
                    style={{ background: "var(--color-red)" }}
                    onClick={() => setDeleteConfirmOpen(true)}
                  >
                    🗑 Delete Practice
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => {
          toast(`✉ Deletion request submitted. You'll receive a confirmation email within 1 hour.`);
        }}
        icon="⚠"
        title="Delete practice permanently?"
        message={`All ${staff.length} team members will lose access. Patient records will be archived for 7 years per HIPAA, then permanently deleted. Subscriptions cancel at the next billing cycle. This action cannot be undone.`}
        confirmLabel="Yes, delete practice"
      />
      <Toast />
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function Card({ title, icon, onSave, children }: { title: string; icon: string; onSave?: () => void; children: ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="py-3 px-5 bg-surface-2 border-b border-border flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md flex items-center justify-center text-[14px] flex-shrink-0 border border-border bg-surface" style={{ background: "var(--color-brand-soft)", color: "var(--color-brand)" }}>
          {icon}
        </div>
        <div className="text-[13px] font-bold uppercase tracking-wider text-ink-2 flex-1">{title}</div>
        {onSave && (
          <button className="btn btn-primary btn-sm" onClick={onSave}>💾 Save Changes</button>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted mb-2.5">{title}</div>
      {children}
    </div>
  );
}

function Field({ label, required, full, children }: { label: string; required?: boolean; full?: boolean; children: ReactNode }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="fl">
        {label}
        {required && <span className="text-red ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange, disabled }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label
      className={[
        "flex items-start gap-3 py-2.5 px-3 rounded-md border cursor-pointer transition-colors",
        checked ? "border-brand-soft bg-brand-soft" : "border-border bg-surface-2",
        disabled ? "opacity-65 cursor-not-allowed" : "hover:border-border-2",
      ].join(" ")}
    >
      <div className="relative mt-0.5 flex-shrink-0">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 cursor-pointer"
          style={{ accentColor: "var(--color-brand)" }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-bold text-ink">
          {label}
          {disabled && <Pill intent="muted">Required</Pill>}
        </div>
        <div className="text-[11px] text-ink-muted mt-0.5 leading-relaxed">{description}</div>
      </div>
    </label>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-surface-2 border border-border rounded p-3 text-center">
      <div className="text-[20px] font-extrabold leading-none" style={{ color }}>{value}</div>
      <div className="text-[9.5px] font-bold uppercase tracking-widest text-ink-muted mt-1.5">{label}</div>
    </div>
  );
}
