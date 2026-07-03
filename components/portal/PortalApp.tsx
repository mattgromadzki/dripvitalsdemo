"use client";

import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import type { ReactNode, CSSProperties } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useShop } from "@/lib/hooks/useShop";
import { usePatients } from "@/lib/hooks/usePatients";
import { useSubscriptions } from "@/lib/hooks/useSubscriptions";
import { getPatientExtra } from "@/lib/data/patientExtras";
import { usePortalRecords } from "@/lib/hooks/usePortalRecords";
import { usePatientAuth } from "@/lib/hooks/usePatientAuth";
import { sendChat, pullChat } from "@/lib/chat/client";
import { seedRecordFromPatient, emptyRecord, formatShotDate } from "@/lib/data/portalRecords";
import type { ShotEntry } from "@/lib/data/portalRecords";
import { SEED_DEMO } from "@/lib/config/runtime";
import { SHOP_CATEGORY_LABEL } from "@/lib/data/shopProducts";
import type { ShopProduct, ShopCategory } from "@/lib/types";
import { validateAddress } from "@/lib/usps/validateAddress";
import { fetchSuggestions, cleanStreet } from "@/lib/usps/autocomplete";
import { AddressLookupBadge } from "@/components/ui/AddressLookupBadge";
import type { UspsValidateResult, UspsValidateInput, AddressSuggestion } from "@/lib/usps/types";

/* ─────────────────────────────────────────────────────────────────────────
   DripVitals Patient Portal (v2)

   A self-contained, patient-facing app: login + six tabs (Home, Chat,
   Treatments, Shots, Shop, Account). All styling is the scoped `.dv-portal`
   stylesheet in globals.css (ported 1:1 from the mockup). The Shop tab reads
   the SAME catalog the admin Shop module manages — published products only —
   so anything an admin publishes shows up here automatically.
   ───────────────────────────────────────────────────────────────────────── */

type Page = "home" | "chat" | "treatments" | "shots" | "reminders" | "shop" | "account" | "help";
type TxTab = "current" | "dose" | "orders" | "subscription";
type AcctTab = "profile" | "billing" | "phi";
type ModalType =
  | "refill" | "pause" | "cancel" | "logWeight" | "logShot"
  | "editProfile" | "editAddress" | "deletePhi" | null;

const PAGE_TITLES: Record<Page, string> = {
  home: "Home", chat: "Chat", treatments: "Treatments",
  shots: "Shots", reminders: "Reminders", shop: "Shop", account: "Account",
  help: "Help Center",
};

const GENERIC_BENEFITS = [
  "Personalized by a licensed provider",
  "Discreet, free shipping to your door",
  "Adjustments at any time, no extra cost",
  "Cancel or pause your subscription anytime",
];
const HOW_IT_WORKS = [
  { t: "Complete intake", d: "Answer a few questions about your goals and health history." },
  { t: "Provider review", d: "A licensed provider reviews your case within 24 hours." },
  { t: "Discreet delivery", d: "Your treatment ships straight to your door in plain packaging." },
  { t: "Ongoing support", d: "Message your care team anytime and adjust your plan as needed." },
];
const WHATS_INCLUDED = [
  "Initial provider consultation",
  "Personalized treatment plan",
  "Free 2-day shipping",
  "24/7 messaging with your care team",
  "Free dose adjustments throughout treatment",
  "No commitment — cancel anytime",
];

// Dose-logging dropdown options (used by the "Add dose" modal).
const MEDICATIONS = [
  "Compounded Semaglutide", "Compounded Tirzepatide", "Ozempic®", "Wegovy®",
  "Mounjaro®", "Zepbound®", "NAD+ Injection", "Sermorelin Injection",
];
const DOSAGE_UNITS = ["mg", "mL", "units"];
const INJECTION_SITES = [
  "Stomach - Upper Left", "Stomach - Upper Right", "Stomach - Lower Left", "Stomach - Lower Right",
  "Thigh - Left", "Thigh - Right", "Arm - Left", "Arm - Right",
];

interface ChatMsg { from: "mine" | "them"; text: string; time: string; attachment?: { name: string; kind: "image" | "pdf"; url: string }; }

export default function PortalApp({ initialAuthed = false }: { initialAuthed?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const allProducts = useShop((s) => s.products);

  // Pull the persisted storefront (incl. admin-uploaded thumbnails) so customers
  // see the same catalog the Shop admin manages. Falls back to the code seed on any error.
  useEffect(() => {
    let alive = true;
    fetch("/api/store/shop")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j && Array.isArray(j.data) && j.data.length) useShop.setState({ products: j.data });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // The logged-in patient (demo: the first EMR patient). Using a real EMR
  // patient is what lets staff open this same person in Patient View and see
  // exactly what they entered here.
  const patients = usePatients((s) => s.patients);
  const sessionPid = usePatientAuth((s) => s.patientId);
  const authPatient = usePatientAuth((s) => s.patient);
  const authHydrated = usePatientAuth((s) => s.hydrated);
  const hydrateAuth = usePatientAuth((s) => s.hydrate);
  const patientLogin = usePatientAuth((s) => s.login);
  const patientLogout = usePatientAuth((s) => s.logout);
  const requestReset = usePatientAuth((s) => s.requestReset);
  const requestResetEmail = usePatientAuth((s) => s.requestResetEmail);
  const confirmReset = usePatientAuth((s) => s.confirmReset);
  const resetPassword = usePatientAuth((s) => s.resetPassword);
  const me = patients.find((p) => p.id === sessionPid) ?? authPatient ?? null;
  const pid = me?.id ?? "";
  const extra = useMemo(() => (me ? getPatientExtra(me) : null), [me]);
  const seed = useMemo(() => (me && extra ? seedRecordFromPatient(me, extra) : emptyRecord()), [me, extra]);

  const records = usePortalRecords((s) => s.records);
  const chatReads = usePortalRecords((s) => s.chatReads);
  const hydrate = usePortalRecords((s) => s.hydrate);
  const ensureSeeded = usePortalRecords((s) => s.ensureSeeded);
  const addShot = usePortalRecords((s) => s.addShot);
  const addWeight = usePortalRecords((s) => s.addWeight);
  const addMessage = usePortalRecords((s) => s.addMessage);
  const markChatRead = usePortalRecords((s) => s.markChatRead);

  // Load persisted entries, then seed this patient if first-seen.
  useEffect(() => { hydrate(); }, [hydrate]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (!e.key || e.key === "dv_portal_records_v2" || e.key === "dv_portal_chat_reads_v1") hydrate(); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [hydrate]);
  useEffect(() => { if (pid) ensureSeeded(pid, seed); }, [pid, seed, ensureSeeded]);

  // Sync chat with the shared server so provider replies arrive across devices.
  useEffect(() => {
    if (!pid) return;
    pullChat(pid);
    const t = setInterval(() => pullChat(pid), 5000);
    return () => clearInterval(t);
  }, [pid]);

  const record = records[pid] ?? seed;
  const fullName = me ? (`${me.first || ""} ${me.last || ""}`.trim() || me.name || "Patient") : "Patient";
  const initials = me ? `${(me.first || me.name || "P").charAt(0)}${(me.last || "T").charAt(0)}`.toUpperCase() : "PT";

  const loggedIn = authHydrated && !!me;
  useEffect(() => { hydrateAuth(); }, [hydrateAuth]);

  // On the patient subdomain the app lives at "/" and sign-in at "/login". On
  // any other host (staff app, preview URLs) the patient app is namespaced under
  // /patient so it never collides with the staff /login and /. These are the
  // public paths used for client-side login/logout navigation.
  const portalPaths = useMemo(() => {
    if (typeof window !== "undefined" && /^(patient|portal)\./i.test(window.location.host)) {
      return { login: "/login", app: "/" };
    }
    return { login: "/patient/login", app: "/patient" };
  }, []);

  // Keep the URL in step with auth state: the sign-in path is always the
  // signed-out screen and the app path is always the app. Runs only after auth
  // hydrates so it never redirects on a not-yet-known session; server middleware
  // enforces the same rules for direct navigation / no-JS.
  //
  // Stale-cookie loop guard: middleware routes on cookie PRESENCE, but the
  // session APIs verify its signature. A stale/invalid dv_patient cookie would
  // make middleware treat the visitor as signed in while the client knows they
  // aren't — bouncing /login → / → /login forever and crashing the router. So
  // before leaving the app path signed-out, clear the dead cookie and do a full
  // navigation, letting middleware re-evaluate with a clean slate.
  const clearingSession = useRef(false);
  useEffect(() => {
    if (!authHydrated) return;
    if (loggedIn && pathname === portalPaths.login) { router.replace(portalPaths.app); return; }
    if (!loggedIn && pathname === portalPaths.app) {
      if (clearingSession.current) return;
      clearingSession.current = true;
      fetch("/api/patient/logout", { method: "POST" })
        .catch(() => {})
        .finally(() => { window.location.replace(portalPaths.login); });
    }
  }, [authHydrated, loggedIn, pathname, portalPaths, router]);
  const [authView, setAuthView] = useState<"login" | "forgot" | "reset">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  // Deep links: ?reset=<token> (emailed reset link) or ?setpw=<email> (welcome
  // invite). Both open the set-password view; the token path is verified server-side.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const reset = params.get("reset");
    const setpw = params.get("setpw");
    if (reset) { setResetToken(reset); setAuthView("reset"); }
    else if (setpw) { setAuthEmail(setpw); setAuthView("reset"); }
    if (reset || setpw) {
      const u = new URL(window.location.href);
      u.searchParams.delete("reset"); u.searchParams.delete("setpw");
      window.history.replaceState({}, "", u.toString());
    }
  }, []);
  const [authPw, setAuthPw] = useState("");
  const [authErr, setAuthErr] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [page, setPage] = useState<Page>("home");
  const [txTab, setTxTab] = useState<TxTab>("current");
  const [acctTab, setAcctTab] = useState<AcctTab>("profile");

  const [threadOpen, setThreadOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const [shopFilter, setShopFilter] = useState<"all" | ShopCategory>("all");
  const [shopSearch, setShopSearch] = useState("");
  const [pdpId, setPdpId] = useState<string | null>(null);

  const [modal, setModal] = useState<ModalType>(null);
  const [weightDraft, setWeightDraft] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [doseReminder, setDoseReminder] = useState(true);
  const [refillReminder, setRefillReminder] = useState(true);

  // Chat thread + current weight, derived from the shared record.
  const chatMessages: ChatMsg[] = record.messages.map((m) => ({
    from: m.from === "patient" ? "mine" : "them",
    text: m.text,
    time: m.time,
    attachment: m.attachment,
  }));
  const currentWeight = record.weights.length
    ? String(record.weights[record.weights.length - 1].lbs)
    : me ? String(me.wt) : "197";

  // Unread = care-team messages the patient hasn't opened yet. The read marker
  // is how many messages were in the thread the last time they viewed it.
  const chatReadCount = chatReads[pid] ?? 0;
  const chatUnread = record.messages
    .slice(chatReadCount)
    .filter((m) => m.from === "care").length;

  // Reading the thread clears unread. Re-runs as new messages arrive while the
  // thread is open, so replies that come in mid-conversation stay marked read.
  useEffect(() => {
    if (pid && page === "chat" && threadOpen) markChatRead(pid, record.messages.length);
  }, [pid, page, threadOpen, record.messages.length, markChatRead]);

  // ── Toasts ──────────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const toastSeq = useRef(0);
  const toast = useCallback((text: string) => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2700);
  }, []);

  // ── Card on file (NetValve hosted update) ────────────────────────────────
  const subscriptions = useSubscriptions((s) => s.subscriptions);
  const mySub = useMemo(() => {
    if (!me) return null;
    const nm = `${me.first} ${me.last}`.toLowerCase();
    return subscriptions.find((s) => s.patientId === me.id)
      || subscriptions.find((s) => (s.patientName || "").toLowerCase() === nm)
      || null;
  }, [subscriptions, me]);
  const [payReady, setPayReady] = useState(false);
  useEffect(() => { fetch("/api/payments/config").then((r) => r.json()).then((c) => setPayReady(c?.provider === "corepay" && !!c?.ready)).catch(() => {}); }, []);

  const updateCard = useCallback(async () => {
    if (!me) return;
    if (!payReady) { toast("Secure card updates aren't enabled in this environment"); return; }
    try {
      const r = await fetch("/api/payments/update-card", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "begin", subscriptionId: mySub?.id, email: me.email, firstName: me.first, lastName: me.last }) });
      const d = await r.json();
      if (d?.ok && d.url) window.location.href = d.url; else toast("⚠️ " + (d?.error || "Couldn't start card update"));
    } catch { toast("⚠️ Couldn't start card update"); }
  }, [payReady, me, mySub, toast]);

  // Handle the return from NetValve's hosted card-update page.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const co = p.get("cardUpdated");
    const cu = p.get("cardUpdate");
    const clean = (key: string) => { const u = new URL(window.location.href); u.searchParams.delete(key); window.history.replaceState({}, "", u.toString()); };
    if (co) {
      fetch("/api/payments/update-card", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "finalize", clientOrderId: co }) })
        .then((r) => r.json())
        .then((d) => toast(d?.ok ? `✓ Card updated${d.last4 ? ` · ending ${d.last4}` : ""}` : "⚠️ " + (d?.error || "Couldn't confirm the new card")))
        .catch(() => toast("⚠️ Couldn't confirm the new card"))
        .finally(() => clean("cardUpdated"));
    } else if (cu === "cancel") { toast("Card update canceled"); clean("cardUpdate"); }
    else if (cu === "failed") { toast("⚠️ Card couldn't be authorized"); clean("cardUpdate"); }
  }, [toast]);


  // ── Shop catalog (published only, sorted) ─────────────────────────────────
  const published = useMemo(
    () => allProducts.filter((p) => p.published).sort((a, b) => a.sort - b.sort),
    [allProducts],
  );
  const shopList = useMemo(() => {
    const q = shopSearch.trim().toLowerCase();
    return published
      .filter((p) => shopFilter === "all" || p.cat === shopFilter)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q));
  }, [published, shopFilter, shopSearch]);
  const pdpProduct = useMemo(
    () => (pdpId ? published.find((p) => p.id === pdpId) ?? null : null),
    [pdpId, published],
  );

  // ── Navigation ────────────────────────────────────────────────────────────
  function nav(p: Page) {
    setPage(p);
    setThreadOpen(false);
    setPdpId(null);
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }

  async function doLogin() {
    const res = await patientLogin(authEmail, authPw, patients);
    if (!res.ok) { setAuthErr(res.error || "Sign in failed."); return; }
    setAuthErr(null); setAuthPw(""); nav("home");
  }
  async function doRequestReset() { await requestResetEmail(authEmail); setResetSent(true); }
  async function doResetPassword() {
    if (resetToken) {
      const res = await confirmReset(resetToken, resetPw);
      if (!res.ok) { setAuthErr(res.error || "Could not reset password."); return; }
      setAuthErr(null); setResetPw(""); setResetToken(""); setResetSent(false);
      toast("Password updated — you're signed in.");
      nav("home");
      return;
    }
    const res = await resetPassword(authEmail, resetPw, patients);
    if (!res.ok) { setAuthErr(res.error || "Could not reset password."); return; }
    setAuthErr(null); setResetPw(""); setResetSent(false); setAuthView("login");
    toast("Password updated — sign in with your new password.");
  }

  function sendMessage() {
    const text = draft.trim();
    if (!text || !pid) return;
    sendChat(pid, { from: "patient", text, time: "Just now" });
    setDraft("");
  }

  function attachFile(file: File) {
    if (!pid || !file) return;
    const kind: "image" | "pdf" = file.type.startsWith("image/") ? "image" : "pdf";
    const reader = new FileReader();
    reader.onload = () => {
      sendChat(pid, { from: "patient", text: "", time: "Just now", attachment: { name: file.name, kind, url: String(reader.result) } });
    };
    reader.readAsDataURL(file);
  }

  function saveWeight() {
    if (!weightDraft) { toast("Please enter a number"); return; }
    if (pid) addWeight(pid, { date: new Date().toLocaleDateString(), lbs: Number(weightDraft) });
    setWeightDraft("");
    setModal(null);
    toast(`Weight logged: ${weightDraft} lbs`);
  }

  function handleAddShot(entry: Omit<ShotEntry, "id">) {
    if (pid) addShot(pid, entry);
    setModal(null);
    toast("Dose logged successfully");
  }

  // ── Login screen ──────────────────────────────────────────────────────────
  if (!loggedIn) {
    // On the app URL we expect a session (server said so). Until auth hydrates,
    // show a neutral splash rather than flashing the sign-in form.
    if (initialAuthed && !authHydrated) {
      return (
        <div className="dv-portal">
          <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="DripVitals" style={{ width: 132, height: "auto", opacity: 0.85 }} />
          </div>
        </div>
      );
    }
    return (
      <div className="dv-portal">
        <div id="login-view" className="login-page">
          <div className="login-left">
            <div className="login-brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="DripVitals" style={{ height: 64, width: "auto", marginBottom: 12 }} />
              <div className="login-brand-sub">Patient Portal</div>
            </div>

            {authView === "login" && (
              <>
                <div className="login-h">Sign in to your DripVitals account</div>
                {authErr && <div style={{ background: "var(--red-soft)", color: "var(--red)", fontSize: 13, fontWeight: 600, padding: "9px 12px", borderRadius: 9, marginBottom: 10 }}>{authErr}</div>}
                <input className="login-input" type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="Email address" />
                <input className="login-input" type="password" value={authPw} onChange={(e) => setAuthPw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doLogin(); }} placeholder="Password" />
                <button className="login-btn" onClick={doLogin}>Sign in</button>
                <div className="login-helpers">
                  <a href="#" onClick={(e) => { e.preventDefault(); setAuthErr(null); setResetSent(false); setAuthView("forgot"); }}>Forgot password?</a>
                </div>
                {SEED_DEMO && (
                  <div style={{ fontSize: 12, color: "var(--ink-muted, #6b7890)", marginTop: 10 }}>
                    Demo account: <b>mattgromadzki@gmail.com</b> · password <b>demo1234</b>
                  </div>
                )}
              </>
            )}

            {authView === "forgot" && (
              <>
                <div className="login-h">Reset your password</div>
                {!resetSent ? (
                  <>
                    <input className="login-input" type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doRequestReset(); }} placeholder="Email address" />
                    <button className="login-btn" onClick={doRequestReset}>Send reset link</button>
                  </>
                ) : (
                  <div style={{ background: "var(--blue-soft, #e7f0fb)", color: "var(--blue-dk, #2c5d8a)", fontSize: 12.5, padding: "9px 12px", borderRadius: 9, marginBottom: 10 }}>
                    If an account exists for that email, we&rsquo;ve sent a password reset link. Check your inbox — the link expires in 30 minutes.
                  </div>
                )}
                <div className="login-helpers"><a href="#" onClick={(e) => { e.preventDefault(); setAuthView("login"); setAuthErr(null); }}>← Back to sign in</a></div>
              </>
            )}

            {authView === "reset" && (
              <>
                <div className="login-h">{resetToken ? "Choose a new password" : "Set a new password"}</div>
                {authErr && <div style={{ background: "var(--red-soft)", color: "var(--red)", fontSize: 13, fontWeight: 600, padding: "9px 12px", borderRadius: 9, marginBottom: 10 }}>{authErr}</div>}
                {!resetToken && (
                  <input className="login-input" type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="Email address" />
                )}
                <input className="login-input" type="password" value={resetPw} onChange={(e) => setResetPw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doResetPassword(); }} placeholder="New password (min 8 characters)" />
                <button className="login-btn" onClick={doResetPassword}>Update password</button>
                <div className="login-helpers"><a href="#" onClick={(e) => { e.preventDefault(); setAuthView("login"); setAuthErr(null); }}>← Back to sign in</a></div>
              </>
            )}

            <div className="login-foot">© 2026 DripVitals · Terms · Privacy</div>
          </div>
          <div className="login-right">
            <div className="login-media">
              <div className="login-pattern" />
              <div className="login-quote">
                <div className="login-quote-text">Modern care for<span className="login-quote-accent">weight loss, energy, and longevity</span></div>
              </div>
            </div>
          </div>
        </div>
        <ToastStack toasts={toasts} />
      </div>
    );
  }

  // ── Portal shell ────────────────────────────────────────────────────────
  return (
    <div className="dv-portal">
      <div id="portal-view" className="portal">
        <aside className="sidebar">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="DripVitals" style={{ width: 150, height: "auto", maxWidth: "100%", marginBottom: 24, marginLeft: 2 }} />
          <NavBtn active={page === "home"} onClick={() => nav("home")} ico="🏠">Home</NavBtn>
          <NavBtn active={page === "chat"} onClick={() => nav("chat")} ico="💬" badge={chatUnread || undefined}>Chat</NavBtn>
          <NavBtn active={page === "treatments"} onClick={() => nav("treatments")} ico="💊">Treatments</NavBtn>
          <NavBtn active={page === "shots"} onClick={() => nav("shots")} ico="💉">Shots</NavBtn>
          <NavBtn active={page === "reminders"} onClick={() => nav("reminders")} ico="🔔">Reminders</NavBtn>
          <NavBtn active={page === "shop"} onClick={() => nav("shop")} ico="🛍️">Shop</NavBtn>
          <div className="sidebar-foot">
            <NavBtn active={page === "account"} onClick={() => nav("account")} ico="👤">Manage account</NavBtn>
            <NavBtn active={page === "help"} onClick={() => nav("help")} ico="❔">Help Center</NavBtn>
            <button className="nav-link" onClick={() => { patientLogout(); setAuthView("login"); }} style={{ color: "var(--red)" }}>
              <span className="ico">↩</span> Sign out
            </button>
          </div>
        </aside>

        <main className="main">
          <div className="main-head">
            <h1 className="main-title">{PAGE_TITLES[page]}</h1>
            <div className="main-actions">
              <button className="bell-btn" onClick={() => nav("chat")} title="Notifications">🔔</button>
              <button className="avatar-btn" onClick={() => nav("account")} title="Account">{initials}</button>
            </div>
          </div>

          <div className="main-body">
            {page === "home" && <HomePage nav={nav} weight={currentWeight} openModal={setModal} />}
            {page === "chat" && (
              <ChatPage
                threadOpen={threadOpen}
                openThread={() => setThreadOpen(true)}
                closeThread={() => setThreadOpen(false)}
                messages={chatMessages}
                draft={draft}
                setDraft={setDraft}
                send={sendMessage}
                onAttach={attachFile}
              />
            )}
            {page === "treatments" && <TreatmentsPage tab={txTab} setTab={setTxTab} openModal={setModal} toast={toast} medication={me?.plan ?? ""} dose={me?.dose} products={published} />}
            {page === "shots" && <ShotsPage openModal={setModal} shots={record.shots} />}
            {page === "reminders" && <RemindersPage doseReminder={doseReminder} setDoseReminder={setDoseReminder} refillReminder={refillReminder} setRefillReminder={setRefillReminder} toast={toast} />}
            {page === "shop" && (
              pdpProduct
                ? <ProductDetail product={pdpProduct} related={published.filter((r) => r.cat === pdpProduct.cat && r.id !== pdpProduct.id).slice(0, 3)} onBack={() => setPdpId(null)} onOpen={setPdpId} toast={toast} />
                : <ShopPage list={shopList} count={shopList.length} filter={shopFilter} setFilter={setShopFilter} search={shopSearch} setSearch={setShopSearch} onOpen={setPdpId} />
            )}
            {page === "account" && <AccountPage tab={acctTab} setTab={setAcctTab} theme={theme} setTheme={setTheme} openModal={setModal} toast={toast} fullName={fullName} initials={initials} cardLast4={mySub?.cardLast4} onUpdateCard={updateCard} />}
            {page === "help" && <HelpPage nav={nav} />}
          </div>
        </main>
      </div>

      {/* Mobile tabbar */}
      <div className="mob-tabbar">
        {(["home", "chat", "treatments", "shots", "reminders"] as Page[]).map((p) => (
          <button key={p} className={`mob-tab ${page === p ? "active" : ""}`} onClick={() => nav(p)}>
            <div className="mob-tab-ico">{p === "home" ? "🏠" : p === "chat" ? "💬" : p === "treatments" ? "💊" : p === "shots" ? "💉" : "🔔"}</div>
            {p === "treatments" ? "Plan" : p === "reminders" ? "Reminders" : p[0].toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {modal && (
        <PortalModal type={modal} onClose={() => setModal(null)} toast={toast}
          weightDraft={weightDraft} setWeightDraft={setWeightDraft} saveWeight={saveWeight} onAddShot={handleAddShot} />
      )}
      <ToastStack toasts={toasts} />
    </div>
  );
}

/* ── Navigation button ── */
function NavBtn({ active, onClick, ico, badge, children }: { active: boolean; onClick: () => void; ico: string; badge?: number; children: ReactNode }) {
  return (
    <button className={`nav-link ${active ? "active" : ""}`} onClick={onClick}>
      <span className="ico">{ico}</span> {children}
      {badge != null && <span className="badge">{badge}</span>}
    </button>
  );
}

/* ── HOME ── */
// Compact "arriving soon" banner on Home — surfaces the soonest in-transit
// shipment for the signed-in patient with a one-tap tracking link.
function HomeArrivingBanner() {
  const [ship, setShip] = useState<PortalShipmentRec | null>(null);
  useEffect(() => {
    fetch("/api/patient/shipments", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const list: PortalShipmentRec[] = Array.isArray(j?.shipments) ? j.shipments : [];
        const active = list.filter((s) => s.status !== "delivered" && s.status !== "exception");
        active.sort((a, b) => {
          const rank = (s: PortalShipmentRec) => (s.status === "out_for_delivery" ? 0 : 1);
          if (rank(a) !== rank(b)) return rank(a) - rank(b);
          return (a.estDelivery || "").localeCompare(b.estDelivery || "");
        });
        setShip(active[0] || null);
      })
      .catch(() => {});
  }, []);
  if (!ship) return null;
  const ofd = ship.status === "out_for_delivery";
  const eta = ship.estDelivery ? new Date(ship.estDelivery) : null;
  const etaLabel = eta && !isNaN(eta.getTime()) ? eta.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }) : null;
  const sub = [
    ship.carrier,
    ofd ? "Out for delivery today" : etaLabel ? `Est. ${etaLabel}` : ship.statusLabel,
    ship.trackingNumber,
  ].filter(Boolean).join(" · ");
  return (
    <div className="arrive-banner">
      <div className="arrive-ico">🚚</div>
      <div className="arrive-body">
        <div className="arrive-title">{ofd ? "Arriving today" : "Arriving soon"}</div>
        <div className="arrive-sub">{sub}</div>
      </div>
      {ship.trackingUrl && <a className="arrive-btn" href={ship.trackingUrl} target="_blank" rel="noreferrer">Track →</a>}
    </div>
  );
}

function HomePage({ nav, weight, openModal }: { nav: (p: Page) => void; weight: string; openModal: (m: ModalType) => void }) {
  return (
    <section className="page active">
      <div className="hero">
        <div className="hero-inner">
          <div>
            <div className="hero-title">3-Month Semaglutide</div>
            <div className="hero-sub">0.5–1.0mg / week · Active subscription</div>
            <div className="hero-meta">
              <HeroMeta lbl="Next dose" val="Sunday, Jun 7" />
              <HeroMeta lbl="Next shipment" val="In 18 days" />
              <HeroMeta lbl="Renews" val="Sep 12, 2026" />
            </div>
            <div style={{ marginTop: 18 }}>
              <button className="btn btn-primary" onClick={() => nav("treatments")}>View plan details →</button>
            </div>
          </div>
          <div className="hero-vial">💉</div>
        </div>
      </div>

      <HomeArrivingBanner />

      <div className="row three">
        <StatCard lbl="Starting weight" val={<>215 <span style={{ fontSize: 14, color: "var(--muted)" }}>lbs</span></>} />
        <StatCard lbl="Current weight" val={<>{weight} <span style={{ fontSize: 14, color: "var(--muted)" }}>lbs</span></>} trend="↓ 18 lbs (8.4%)" />
        <StatCard lbl="Goal" val={<>180 <span style={{ fontSize: 14, color: "var(--muted)" }}>lbs</span></>} trend="17 lbs to go" />
      </div>

      <div className="row two">
        <div className="card">
          <div className="card-h">Quick actions</div>
          <QaCard ico="💉" title="Log this week's shot" desc="Next dose due Sunday, Jun 7" onClick={() => nav("shots")} />
          <QaCard ico="⚖️" title="Log this week's weight" desc="Last logged: May 24" onClick={() => openModal("logWeight")} />
          <QaCard ico="💬" title="Message your care team" desc="Average response: 2 hours" onClick={() => nav("chat")} />
        </div>
        <div className="card">
          <div className="card-h">Recent activity</div>
          <div className="timeline">
            <TimelineItem dot="done" title="Shot logged · 0.5mg" desc="Left thigh · May 24" />
            <TimelineItem dot="done" title="Weight logged · 197 lbs" desc="May 24" />
            <TimelineItem dot="done" title="Refill #2 shipped" desc="Arrives Jun 5" />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroMeta({ lbl, val }: { lbl: string; val: string }) {
  return (
    <div className="hero-meta-item">
      <div className="hero-meta-lbl">{lbl}</div>
      <div className="hero-meta-val">{val}</div>
    </div>
  );
}
function StatCard({ lbl, val, trend }: { lbl: string; val: ReactNode; trend?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-lbl">{lbl}</div>
      <div className="stat-val">{val}</div>
      {trend && <div className="stat-trend">{trend}</div>}
    </div>
  );
}
function QaCard({ ico, title, desc, onClick }: { ico: string; title: string; desc: string; onClick: () => void }) {
  return (
    <button className="qa-card" style={{ width: "100%", textAlign: "left" }} onClick={onClick}>
      <div className="qa-icon">{ico}</div>
      <div className="qa-body">
        <div className="qa-title">{title}</div>
        <div className="qa-desc">{desc}</div>
      </div>
      <div className="qa-arrow">→</div>
    </button>
  );
}

/* ── HELP CENTER ── */
function HelpPage({ nav }: { nav: (p: Page) => void }) {
  const faqs: { q: string; a: string }[] = [
    { q: "How soon will my medication arrive?", a: "Once a provider approves your treatment and your payment clears, your compounding pharmacy typically ships within 2–5 business days. You'll get a tracking link by email, and you can follow every step under Treatments → Orders." },
    { q: "When and how do I take my dose?", a: "Your provider sets a personalized titration schedule, which you can view any time under Treatments. Log each injection in the Shots tab so your care team can keep your plan on track. If you're ever unsure about timing or you miss a dose, message your care team before making any changes." },
    { q: "What should I do about side effects?", a: "Mild nausea, fatigue, or appetite changes are common early on and usually ease over time. Message your care team about anything that concerns you. Seek immediate medical attention for severe symptoms such as trouble breathing, severe abdominal pain, or signs of an allergic reaction." },
    { q: "How do I pause, adjust, or cancel my plan?", a: "You're in control. Open Treatments → Subscription to pause, change your cadence, or cancel — no fees and no penalties. Changes take effect on your next billing cycle." },
    { q: "How does billing work?", a: "Your first month is billed at the intro price shown at checkout, then your plan renews monthly (or quarterly) until you pause or cancel. Manage your card and view past charges under Manage account → Billing." },
    { q: "How do I update my shipping address or payment card?", a: "Go to Manage account. You can edit your profile and shipping address under Profile, and update your payment method under Billing. Address changes apply to your next shipment." },
    { q: "Is my information private?", a: "Yes. DripVitals is HIPAA-compliant and your health information is encrypted in transit and at rest. You can review what's on file and request an export or deletion under Manage account → Privacy." },
  ];
  return (
    <section className="page active">
      <div className="hero" style={{ marginBottom: 22 }}>
        <div className="hero-inner">
          <div>
            <h2 className="hero-title">How can we help?</h2>
            <p className="hero-sub">Answers to common questions about your treatment, shipping, and account. Still stuck? Your care team is one message away.</p>
          </div>
          <div className="hero-vial">❔</div>
        </div>
      </div>

      <div className="row two" style={{ marginBottom: 22 }}>
        <QaCard ico="💬" title="Message your care team" desc="Average response: 2 hours" onClick={() => nav("chat")} />
        <QaCard ico="💊" title="View your treatment plan" desc="Dose schedule, orders & tracking" onClick={() => nav("treatments")} />
      </div>

      <h2 className="pdp-section-h" style={{ fontSize: 20, marginBottom: 14 }}>Frequently asked questions</h2>
      {faqs.map((f, i) => (
        <details className="pdp-faq" key={i}>
          <summary>{f.q}</summary>
          <div className="pdp-faq-answer">{f.a}</div>
        </details>
      ))}

      <div className="help-card">
        <div className="help-ico">💬</div>
        <div style={{ flex: 1 }}>
          <div className="help-title">Still need help?</div>
          <div className="help-desc">Message your DripVitals care team — we usually reply within a few hours.</div>
        </div>
        <button className="btn btn-primary" onClick={() => nav("chat")}>Message us</button>
      </div>

      <div className="pdp-safety" style={{ marginTop: 22 }}>
        <div className="pdp-safety-h">⚠️ In an emergency</div>
        <div className="pdp-safety-body">This portal is not for medical emergencies. If you are experiencing a medical emergency, call 911 or go to the nearest emergency room.</div>
      </div>
    </section>
  );
}
function TimelineItem({ dot, title, desc, date }: { dot: string; title: string; desc: string; date?: string }) {
  return (
    <div className="timeline-item">
      <div className={`timeline-dot ${dot === "done" ? "done" : dot === "now" ? "now" : ""}`}>
        {dot === "done" ? "✓" : dot === "now" ? "●" : dot}
      </div>
      <div className="timeline-body">
        <div className="timeline-title">{title}</div>
        <div className="timeline-desc">{desc}</div>
      </div>
      {date && <div className="timeline-date">{date}</div>}
    </div>
  );
}

/* ── CHAT ── */
function ChatPage({ threadOpen, openThread, closeThread, messages, draft, setDraft, send, onAttach }: {
  threadOpen: boolean; openThread: () => void; closeThread: () => void;
  messages: ChatMsg[]; draft: string; setDraft: (s: string) => void; send: () => void; onAttach: (f: File) => void;
}) {
  return (
    <section className="page active">
      {!threadOpen ? (
        <div>
          <div className="chat-eyebrow">Support</div>
          <div className="chat-empty">
            <div className="chat-empty-ico">💬</div>
            <div className="chat-empty-title">We&rsquo;re here to help</div>
            <div className="chat-empty-desc">Questions about billing, shipping, your account, or your treatment? Message your DripVitals care team — we usually reply within a few hours.</div>
            <button className="chat-start-btn" onClick={openThread}>
              <span className="msg-ava team">CT<span className="ava-dot" /></span>
              <span>
                <span className="chat-start-name">Message Support</span>
                <span className="chat-start-sub">DripVitals Care Team · Online</span>
              </span>
              <span className="chat-start-arrow">→</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="thread">
          <div className="thread-head">
            <button className="thread-back" onClick={closeThread} aria-label="Back">←</button>
            <div className="msg-ava team">CT<span className="ava-dot" /></div>
            <div>
              <div className="thread-name">DripVitals Care Team</div>
              <div className="thread-status"><span className="status-dot" />Online · replies within a few hours</div>
            </div>
          </div>
          <div className="thread-body">
            {messages.length === 0 && (
              <div className="thread-hint">👋 Say hello — your care team will reply here.</div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`thread-row ${m.from === "mine" ? "mine" : ""}`}>
                {m.from !== "mine" && <div className="msg-ava team xs">CT</div>}
                <div>
                  <div className="thread-bubble">
                    {m.attachment && (m.attachment.kind === "image"
                      ? <img src={m.attachment.url} alt={m.attachment.name} className="thread-img" />
                      : <a href={m.attachment.url} download={m.attachment.name} className="thread-file">📄 {m.attachment.name}</a>)}
                    {m.text && <span>{m.text}</span>}
                  </div>
                  <div className="thread-meta">{m.time}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="thread-foot">
            <label className="thread-attach" title="Attach photo or PDF">
              📎
              <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onAttach(f); e.target.value = ""; }} />
            </label>
            <input
              className="thread-input"
              placeholder="Type a message…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            />
            <button className="thread-send" onClick={send} aria-label="Send" disabled={!draft.trim()}>↑</button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ── TREATMENTS ── */
interface PortalPharmEvent { id: string; event?: string; status?: string; stage?: string; trackingNumber?: string; trackingUrl?: string; carrier?: string; at: string }

function stageMeta(stage?: string): { label: string; pill: "pending" | "active" | "danger" } {
  switch ((stage || "").toLowerCase()) {
    case "requested": return { label: "Order received", pill: "pending" };
    case "filling":   return { label: "Being filled", pill: "pending" };
    case "ready":     return { label: "Packed & shipped", pill: "pending" };
    case "shipped":   return { label: "In transit", pill: "pending" };
    case "delivered": return { label: "Delivered", pill: "active" };
    case "issue":     return { label: "Shipping issue", pill: "danger" };
    case "held":      return { label: "On hold", pill: "pending" };
    case "cancelled": return { label: "Cancelled", pill: "danger" };
    case "voided":    return { label: "Cancelled", pill: "danger" };
    default:          return { label: "Update", pill: "pending" };
  }
}

interface PortalShipmentRec {
  id: string; status: string; statusLabel: string; carrier?: string;
  trackingNumber?: string; trackingUrl?: string; pharmacy?: string;
  shippedAt?: string; estDelivery?: string;
  events: { ts: string; status: string; location?: string; note?: string }[];
}
function shipPill(status: string): "pending" | "active" | "review" | "danger" {
  switch ((status || "").toLowerCase()) {
    case "delivered": return "active";
    case "out_for_delivery": return "review";
    case "exception": return "danger";
    default: return "pending";
  }
}
const fmtShipDate = (s?: string) => { if (!s) return ""; const d = new Date(s); return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); };
const fmtShipDateTime = (s?: string) => { if (!s) return ""; const d = new Date(s); return isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); };

// Live shipment tracking for the signed-in patient: EMR shipments (with a
// public carrier tracking link) + GreenstoneRX fulfillment events.
function PortalShipmentTracking({ toast }: { toast: (s: string) => void }) {
  const [shipments, setShipments] = useState<PortalShipmentRec[]>([]);
  const [events, setEvents] = useState<PortalPharmEvent[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([
      fetch("/api/patient/shipments", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      fetch("/api/patient/pharmacy-events", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
    ]).then(([sh, ph]) => {
      setShipments(Array.isArray(sh?.shipments) ? sh.shipments : []);
      setEvents(Array.isArray(ph?.events) ? ph.events : []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="card" style={{ marginBottom: 18 }}><div className="card-h">Shipments</div><div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 6 }}>Loading…</div></div>;
  }
  if (shipments.length === 0 && events.length === 0) {
    return (
      <div className="ship-empty">
        <div className="ship-empty-ico">📦</div>
        <div style={{ fontWeight: 700, fontSize: 15 }}>No active shipments</div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4, maxWidth: 360 }}>We&rsquo;ll text and email you a tracking link the moment your next order ships.</div>
      </div>
    );
  }

  const phTracked = events.find((e) => e.trackingNumber);
  const phLatest = events[0];

  return (
    <>
      {shipments.map((sh) => (
        <div key={sh.id} className="ship-card">
          <div className="ship-card-top">
            <div>
              <div className="ship-carrier">{sh.carrier || "Shipment"}{sh.pharmacy ? <span className="ship-pharmacy"> · {sh.pharmacy}</span> : null}</div>
              {sh.estDelivery && <div className="ship-eta">Est. delivery {fmtShipDate(sh.estDelivery)}</div>}
            </div>
            <span className={`pill ${shipPill(sh.status)}`}>{sh.statusLabel}</span>
          </div>
          {sh.trackingNumber && (
            <div className="ship-track"><span className="ship-track-label">Tracking #</span><span className="ship-track-num">{sh.trackingNumber}</span></div>
          )}
          {sh.trackingUrl
            ? <a className="ship-btn" href={sh.trackingUrl} target="_blank" rel="noreferrer">Track package →</a>
            : <button className="ship-btn ghost" onClick={() => toast("A tracking link will appear once the carrier scans your package")}>Track package</button>}
          {sh.events.length > 0 && (
            <div className="ship-history">
              {sh.events.slice().reverse().map((e, i) => (
                <div key={i} className="ship-ev">
                  <span className={`ship-ev-dot ${i === 0 ? "now" : ""}`} />
                  <div>
                    <div className="ship-ev-note">{e.note || e.status}</div>
                    <div className="ship-ev-meta">{[e.location, fmtShipDateTime(e.ts)].filter(Boolean).join(" · ")}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {events.length > 0 && (
        <div className="ship-card">
          <div className="ship-card-top">
            <div>
              <div className="ship-carrier">Pharmacy order{phTracked?.carrier ? ` · ${phTracked.carrier}` : ""}</div>
              {phLatest && <div className="ship-eta">Updated {fmtShipDateTime(phLatest.at)}</div>}
            </div>
            <span className={`pill ${stageMeta(phLatest?.stage).pill}`}>{stageMeta(phLatest?.stage).label}</span>
          </div>
          {phTracked?.trackingNumber && (
            <div className="ship-track"><span className="ship-track-label">Tracking #</span><span className="ship-track-num">{phTracked.trackingNumber}</span></div>
          )}
          {phTracked?.trackingUrl
            ? <a className="ship-btn" href={phTracked.trackingUrl} target="_blank" rel="noreferrer">Track package →</a>
            : <button className="ship-btn ghost" onClick={() => toast("Tracking will appear here as soon as your order ships")}>Track package</button>}
          <div className="ship-history">
            {events.map((e, i) => {
              const m = stageMeta(e.stage);
              return (
                <div key={e.id} className="ship-ev">
                  <span className={`ship-ev-dot ${i === 0 ? "now" : ""}`} />
                  <div>
                    <div className="ship-ev-note">{m.label}{e.status ? ` — ${e.status}` : ""}</div>
                    <div className="ship-ev-meta">{fmtShipDateTime(e.at)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

/* Map a patient's plan/medication text (e.g. "3-Month Sema", "Compounded
   Tirzepatide") to the matching Shop product, so the Treatments page can show
   that product's real photo instead of a generic icon. */
const MED_KEYWORDS: { key: string; needle: string }[] = [
  { key: "semaglutide", needle: "semaglutide" },
  { key: "sema", needle: "semaglutide" },
  { key: "tirzepatide", needle: "tirzepatide" },
  { key: "tirz", needle: "tirzepatide" },
  { key: "metformin", needle: "metformin" },
  { key: "sermorelin", needle: "sermorelin" },
  { key: "testosterone", needle: "testosterone" },
  { key: "trt", needle: "testosterone" },
  { key: "sildenafil", needle: "sildenafil" },
  { key: "tadalafil", needle: "tadalafil" },
  { key: "nad", needle: "nad" },
  { key: "b12", needle: "b12" },
];

function matchTreatmentProduct(medication: string, products: ShopProduct[]): ShopProduct | undefined {
  const m = (medication || "").toLowerCase();
  if (!m || !products.length) return undefined;
  const needle = MED_KEYWORDS.find((k) => m.includes(k.key))?.needle;
  if (needle) {
    const byName = products.find((p) => (p?.name || "").toLowerCase().includes(needle));
    if (byName) return byName;
  }
  // Fallback: a product whose name shares a distinctive word with the plan.
  return products.find((p) => {
    const n = (p?.name || "").toLowerCase();
    return m.split(/\s+/).some((w) => w.length >= 4 && n.includes(w));
  });
}

function prettifyMedication(plan: string): string {
  const m = (plan || "").toLowerCase();
  if (m.includes("tirz")) return "Compounded Tirzepatide";
  if (m.includes("sema")) return "Compounded Semaglutide";
  if (m.includes("metformin")) return "Metformin";
  return plan || "";
}

function TreatmentsPage({ tab, setTab, openModal, toast, medication = "", dose, products = [] }: { tab: TxTab; setTab: (t: TxTab) => void; openModal: (m: ModalType) => void; toast: (s: string) => void; medication?: string; dose?: string; products?: ShopProduct[] }) {
  const rx = matchTreatmentProduct(medication, products);
  const medName = rx?.name || prettifyMedication(medication) || "Your treatment plan";
  const subLine = `${dose ? `${dose} · ` : ""}Compounded · Pharmacy: Partner Network FL`;
  return (
    <section className="page active">
      <div className="inner-tabs">
        <InnerTab active={tab === "current"} onClick={() => setTab("current")}>Current plan</InnerTab>
        <InnerTab active={tab === "dose"} onClick={() => setTab("dose")}>Dose schedule</InnerTab>
        <InnerTab active={tab === "orders"} onClick={() => setTab("orders")}>Shipments</InnerTab>
        <InnerTab active={tab === "subscription"} onClick={() => setTab("subscription")}>Subscription</InnerTab>
      </div>

      {tab === "current" && (
        <div className="inner-tab-content active">
          <div className="hero">
            <div className="hero-inner">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                  <span className="pill active">Active</span>
                  <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Started Mar 12, 2026</span>
                </div>
                <div className="hero-title">{medName}</div>
                <div className="hero-sub">{subLine}</div>
                <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="btn btn-primary" onClick={() => openModal("refill")}>Request refill</button>
                  <button className="btn btn-secondary" onClick={() => openModal("pause")}>Pause subscription</button>
                </div>
              </div>
              <div
                className="hero-vial"
                style={rx?.imageUrl
                  ? { overflow: "hidden", padding: 0, transform: "none", background: "#eef4fa", boxShadow: "0 10px 28px rgba(30,45,75,.18)" }
                  : undefined}
              >
                {rx?.imageUrl
                  ? <img src={rx.imageUrl} alt={rx.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : (rx?.img || "💉")}
              </div>
            </div>
          </div>
          <div className="plan-meta-grid">
            <PlanCell lbl="Current dose" val="0.5 mg / week" />
            <PlanCell lbl="Next dose increase" val="0.75 mg in 2 wk" />
            <PlanCell lbl="Billed quarterly" val="$499 / 3 mo" />
            <PlanCell lbl="Next renewal" val="Sep 12, 2026" />
          </div>
        </div>
      )}

      {tab === "dose" && (
        <div className="inner-tab-content active">
          <div className="card">
            <div className="card-h">Dose escalation timeline</div>
            <div className="timeline">
              <TimelineItem dot="done" title="Week 1-4 · 0.25 mg starter dose" desc="Initial introduction — your body adjusts to the medication." date="Mar 12 – Apr 8" />
              <TimelineItem dot="now" title="Week 5-8 · 0.5 mg (current)" desc="Most patients see noticeable appetite changes at this dose." date="Apr 9 – May 6" />
              <TimelineItem dot="3" title="Week 9-12 · 0.75 mg" desc="Mid-cycle escalation — review with your provider before this step." date="Jun 4 – Jul 1" />
              <TimelineItem dot="4" title="Week 13-16 · 1.0 mg target dose" desc="Maintenance dose — final step of the 3-month plan." date="Jul 2 – Jul 29" />
            </div>
          </div>
        </div>
      )}

      {tab === "orders" && (
        <div className="inner-tab-content active">
          <PortalShipmentTracking toast={toast} />
          <div className="card">
            <div className="card-h">Order history</div>
            <div className="timeline">
              <TimelineItem dot="done" title="Order #DV-2502 · Refill #1" desc="Delivered Apr 12, 2026" date="$499.00" />
              <TimelineItem dot="done" title="Order #DV-2104 · Initial" desc="Delivered Mar 12, 2026" date="$499.00" />
            </div>
          </div>
        </div>
      )}

      {tab === "subscription" && (
        <div className="inner-tab-content active">
          <div className="card">
            <div className="card-h">Subscription details</div>
            <div className="plan-meta-grid" style={{ marginTop: 12 }}>
              <PlanCell lbl="Status" val={<span className="pill active">Active</span>} />
              <PlanCell lbl="Billing cycle" val="Quarterly" />
              <PlanCell lbl="Amount" val="$499.00" />
              <PlanCell lbl="Next charge" val="Sep 12, 2026" />
            </div>
            <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn btn-secondary" onClick={() => openModal("pause")}>Pause subscription</button>
              <button className="btn btn-danger" onClick={() => openModal("cancel")}>Cancel subscription</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
function InnerTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button className={`inner-tab ${active ? "active" : ""}`} onClick={onClick}>{children}</button>;
}
function PlanCell({ lbl, val }: { lbl: string; val: ReactNode }) {
  return (
    <div className="plan-meta-cell">
      <div className="plan-meta-lbl">{lbl}</div>
      <div className="plan-meta-val">{val}</div>
    </div>
  );
}

/* ── SHOTS ── */
function ShotsPage({ openModal, shots }: { openModal: (m: ModalType) => void; shots: ShotEntry[] }) {
  const completed = shots.length;
  return (
    <section className="page active">
      <div className="shot-next">
        <div className="shot-next-lbl">Next dose</div>
        <div className="shot-next-day">Sunday, Jun 7</div>
        <div className="shot-next-dose">0.5mg Semaglutide · Subcutaneous injection</div>
        <button className="shot-log-btn" onClick={() => openModal("logShot")}>💉 Log this week&apos;s shot</button>
      </div>

      <div className="row three">
        <StatCard lbl="Shots completed" val={<>{completed}</>} trend={`${completed} of 16 weeks`} />
        <StatCard lbl="Compliance" val={<>100%</>} trend="Never missed a week" />
        <StatCard lbl="Current streak" val={<>{completed} wk</>} trend="🔥 Keep it going!" />
      </div>

      <ShotCalendar shots={shots} />

      <div className="card">
        <div className="card-h">Shot history</div>
        <div className="shot-log-list">
          {shots.length === 0 ? (
            <div style={{ padding: "20px 0", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No shots logged yet.</div>
          ) : shots.map((s) => (
            <div key={s.id} className="shot-log-row">
              <div className="shot-log-ico">💉</div>
              <div className="shot-log-body">
                <div className="shot-log-title">{formatShotDate(s.date)} · {s.strength}{s.unit} {s.medication}</div>
                <div className="shot-log-meta">{s.site}</div>
              </div>
              <span className="pill active">Logged</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Reminders: dose/refill reminders + upcoming doses. No visit scheduling —
   the intake form is the visit in this async-care model. ── */
function RemindersPage({ doseReminder, setDoseReminder, refillReminder, setRefillReminder, toast }: {
  doseReminder: boolean; setDoseReminder: (b: boolean) => void;
  refillReminder: boolean; setRefillReminder: (b: boolean) => void;
  toast: (s: string) => void;
}) {
  const doses = useMemo(() => {
    const out: { date: string; dose: string }[] = [];
    const d = new Date(); d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
    for (let i = 0; i < 4; i++) {
      out.push({ date: d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }), dose: "0.5mg Semaglutide" });
      d.setDate(d.getDate() + 7);
    }
    return out;
  }, []);
  const next = doses[0];

  return (
    <section className="page active">
      {/* Next dose banner */}
      <div className="shot-next">
        <div className="shot-next-lbl">Next dose</div>
        <div className="shot-next-day">{next ? next.date : "—"}</div>
        <div className="shot-next-dose">{next ? `${next.dose} · subcutaneous` : "No upcoming doses"}</div>
      </div>

      {/* Reminders */}
      <div className="card">
        <div className="card-h">Reminders</div>
        <ReminderRow ico="💉" title="Weekly dose reminder" desc="Get a text + email the day your shot is due." on={doseReminder} onToggle={() => { setDoseReminder(!doseReminder); toast(!doseReminder ? "Dose reminders on" : "Dose reminders off"); }} />
        <ReminderRow ico="📦" title="Refill reminder" desc="We'll remind you before your next refill ships." on={refillReminder} onToggle={() => { setRefillReminder(!refillReminder); toast(!refillReminder ? "Refill reminders on" : "Refill reminders off"); }} />
      </div>

      {/* Upcoming doses */}
      <div className="card">
        <div className="card-h">Upcoming doses</div>
        <div className="shot-log-list">
          {doses.map((d, i) => (
            <div key={i} className="shot-log-row">
              <div className="shot-log-ico">💉</div>
              <div className="shot-log-body">
                <div className="shot-log-title">{d.date}</div>
                <div className="shot-log-meta">{d.dose} · subcutaneous</div>
              </div>
              <span className="pill active">{i === 0 ? "Next" : "Scheduled"}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
function ReminderRow({ ico, title, desc, on, onToggle }: { ico: string; title: string; desc: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="shot-log-row" style={{ alignItems: "center" }}>
      <div className="shot-log-ico">{ico}</div>
      <div className="shot-log-body">
        <div className="shot-log-title">{title}</div>
        <div className="shot-log-meta">{desc}</div>
      </div>
      <button onClick={onToggle} role="switch" aria-checked={on}
        style={{ width: 42, height: 24, borderRadius: 999, position: "relative", cursor: "pointer", transition: "background .15s",
          border: "none", background: on ? "var(--blue)" : "var(--border)" }}>
        <span style={{ position: "absolute", top: 2, left: on ? 20 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
      </button>
    </div>
  );
}

/* Interactive month calendar that marks the days the patient logged a shot,
   with prev/next month navigation and a tap-to-see-details day. */
function ShotCalendar({ shots }: { shots: ShotEntry[] }) {
  const today = new Date();
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [selected, setSelected] = useState<number | null>(null);

  const shotsByDay = new Map<number, ShotEntry>();
  for (const s of shots) {
    const mm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.date);
    if (!mm) continue;
    if (Number(mm[1]) === view.y && Number(mm[2]) - 1 === view.m) shotsByDay.set(Number(mm[3]), s);
  }

  const firstWeekday = (new Date(view.y, view.m, 1).getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const isCurrentMonth = view.y === today.getFullYear() && view.m === today.getMonth();
  const monthLabel = new Date(view.y, view.m, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const go = (delta: number) => {
    setSelected(null);
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };
  const navBtn: CSSProperties = { border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 8, width: 30, height: 30, cursor: "pointer", fontSize: 16, color: "var(--text-2)", lineHeight: 1 };
  const selShot = selected != null ? shotsByDay.get(selected) : undefined;

  return (
    <div className="card" style={{ marginBottom: 22 }}>
      <div className="card-h" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>Shot calendar</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button style={navBtn} onClick={() => go(-1)} aria-label="Previous month">‹</button>
          <span className="right" style={{ minWidth: 120, textAlign: "center" }}>{monthLabel}</span>
          <button style={navBtn} onClick={() => go(1)} aria-label="Next month">›</button>
        </span>
      </div>
      <div className="shot-calendar">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="shot-cal-header">{d}</div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="shot-cal-cell" />;
          const has = shotsByDay.has(d);
          const isToday = isCurrentMonth && d === today.getDate();
          const isFuture = isCurrentMonth && d > today.getDate();
          const isSel = selected === d;
          return (
            <div
              key={i}
              className={`shot-cal-cell ${has ? "has-shot" : ""} ${isToday ? "today" : ""} ${isFuture ? "future" : ""}`}
              title={has ? "Shot logged — tap for details" : undefined}
              onClick={() => has && setSelected(isSel ? null : d)}
              style={{ cursor: has ? "pointer" : "default", outline: isSel ? "2px solid var(--blue)" : undefined, outlineOffset: -2 }}
            >
              {d}
            </div>
          );
        })}
      </div>
      {selShot && (
        <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--blue-soft)", borderRadius: 10, fontSize: 13, color: "var(--text)" }}>
          <strong>{formatShotDate(selShot.date)}</strong> — {selShot.strength}{selShot.unit} {selShot.medication} · {selShot.site}
        </div>
      )}
    </div>
  );
}

/* ── SHOP (catalog) ── */
function ShopPage({ list, count, filter, setFilter, search, setSearch, onOpen }: {
  list: ShopProduct[]; count: number;
  filter: "all" | ShopCategory; setFilter: (f: "all" | ShopCategory) => void;
  search: string; setSearch: (s: string) => void; onOpen: (id: string) => void;
}) {
  const filters: ("all" | ShopCategory)[] = ["all", "weight", "anti-aging", "hair", "sexual", "skin"];
  return (
    <section className="page active">
      <div className="shop-hero">Discover what truly fits your lifestyle. From daily energy to long-term balance. Your goals, your way.</div>
      <div className="shop-search">
        <span className="shop-search-ico">🔍</span>
        <input className="shop-search-input" placeholder="Search product" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="shop-filters">
        {filters.map((f) => (
          <button key={f} className={`shop-filter ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
            {f === "all" ? "All" : SHOP_CATEGORY_LABEL[f]}
          </button>
        ))}
      </div>
      <div className="shop-count">{count} product{count === 1 ? "" : "s"}</div>
      <div className="shop-grid">
        {list.map((p) => <ProductCard key={p.id} p={p} onOpen={onOpen} />)}
      </div>
    </section>
  );
}
function ProductCard({ p, onOpen }: { p: ShopProduct; onOpen: (id: string) => void }) {
  return (
    <div className="product-card" onClick={() => onOpen(p.id)}>
      <div className={`product-img ${p.cls}`} style={p.imageUrl ? { overflow: "hidden" } : undefined}>{p.imageUrl ? <img src={p.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : p.img}</div>
      <div className="product-body">
        <div className="product-tag">{p.tag}</div>
        <div className="product-name">{p.name}</div>
        <div className="product-desc">{p.desc}</div>
        <div className="product-price">As low as <strong>${p.price}/mo</strong>*</div>
      </div>
    </div>
  );
}

/* ── SHOP (product detail) ── */
function ProductDetail({ product: p, related, onBack, onOpen, toast }: {
  product: ShopProduct; related: ShopProduct[]; onBack: () => void; onOpen: (id: string) => void; toast: (s: string) => void;
}) {
  const subtitle = p.longDesc || `${p.desc} Personalized by a licensed provider — no insurance required.`;
  const benefits = p.benefits && p.benefits.length ? p.benefits : GENERIC_BENEFITS;
  const faqs = p.faqs && p.faqs.length ? p.faqs : [
    { q: `What is ${p.name}?`, a: `${p.name} is part of our ${p.tag.split(" · ")[0].toLowerCase()} treatment lineup, prescribed by a licensed provider after a quick online intake.` },
    { q: "Do I need insurance?", a: "No. Our pricing is cash-pay and includes everything — provider consultation, medication, and ongoing care." },
    { q: "How quickly will my order ship?", a: "Once your provider approves your prescription, orders typically ship within 2–3 business days via free 2-day shipping." },
    { q: "Can I cancel anytime?", a: "Yes. You can pause or cancel your subscription anytime from your patient portal — no penalties, no commitment." },
  ];
  const safety = p.safety || "Discuss your full medical history and any medications with your provider before starting treatment. Report any unexpected side effects promptly.";

  return (
    <section className="page active">
      <button className="pdp-back" onClick={onBack}>← Back to Shop</button>
      <div className="pdp-hero">
        <div className={`pdp-hero-img product-img ${p.cls}`} style={p.imageUrl ? { overflow: "hidden" } : undefined}>{p.imageUrl ? <img src={p.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : p.img}</div>
        <div className="pdp-hero-info">
          <div className="pdp-tag">{p.tag}</div>
          <h1 className="pdp-name">{p.name}</h1>
          <div className="pdp-rating">
            <span className="pdp-stars">★★★★★</span>
            <span>4.8 · 1,247 reviews</span>
          </div>
          <div className="pdp-subtitle">{subtitle}</div>
          <ul className="pdp-benefits">
            {benefits.map((b, i) => <li key={i}><span className="check">✓</span>{b}</li>)}
          </ul>
          <div className="pdp-price-box">
            <div className="pdp-price-intro-lbl">First month special</div>
            <div className="pdp-price-row">
              <div className="pdp-price-big">${p.firstMonth}</div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>first month</div>
            </div>
            <div className="pdp-price-after">Then ${p.price}/month · cancel anytime</div>
          </div>
          <button className="pdp-cta" onClick={() => toast(`Starting treatment for ${p.name}…`)}>Get Started →</button>
          <div className="pdp-trust">
            <span>🔒 HIPAA-secure</span><span>·</span>
            <span>📦 Free shipping</span><span>·</span>
            <span>🩺 US-licensed providers</span>
          </div>
        </div>
      </div>

      <div className="pdp-section">
        <h2 className="pdp-section-h">How it works</h2>
        <div className="pdp-steps">
          {HOW_IT_WORKS.map((s, i) => (
            <div key={i} className="pdp-step">
              <div className="pdp-step-num">{i + 1}</div>
              <div className="pdp-step-title">{s.t}</div>
              <div className="pdp-step-desc">{s.d}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="pdp-section">
        <h2 className="pdp-section-h">What&apos;s included</h2>
        <div className="pdp-included">
          <div className="pdp-included-grid">
            {WHATS_INCLUDED.map((item, i) => (
              <div key={i} className="pdp-included-item"><span className="check">✓</span>{item}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="pdp-section">
        <h2 className="pdp-section-h">Frequently asked questions</h2>
        {faqs.map((f, i) => (
          <details key={i} className="pdp-faq" open={i === 0}>
            <summary>{f.q}</summary>
            <div className="pdp-faq-answer">{f.a}</div>
          </details>
        ))}
      </div>

      <div className="pdp-section">
        <h2 className="pdp-section-h">Safety information</h2>
        <div className="pdp-safety">
          <div className="pdp-safety-h">⚠ Important safety information</div>
          <div className="pdp-safety-body">{safety}</div>
        </div>
      </div>

      {related.length > 0 && (
        <div className="pdp-section">
          <h2 className="pdp-section-h">You might also like</h2>
          <div className="pdp-related-grid">
            {related.map((rp) => <ProductCard key={rp.id} p={rp} onOpen={onOpen} />)}
          </div>
        </div>
      )}
    </section>
  );
}

/* ── ACCOUNT ── */
function AccountPage({ tab, setTab, theme, setTheme, openModal, toast, fullName, initials, cardLast4, onUpdateCard }: {
  tab: AcctTab; setTab: (t: AcctTab) => void;
  theme: "light" | "dark"; setTheme: (t: "light" | "dark") => void;
  openModal: (m: ModalType) => void; toast: (s: string) => void;
  fullName: string; initials: string;
  cardLast4?: string; onUpdateCard: () => void;
}) {
  return (
    <section className="page active">
      <div className="inner-tabs">
        <InnerTab active={tab === "profile"} onClick={() => setTab("profile")}>Profile</InnerTab>
        <InnerTab active={tab === "billing"} onClick={() => setTab("billing")}>Billing &amp; Shipping</InnerTab>
        <InnerTab active={tab === "phi"} onClick={() => setTab("phi")}>PHI</InnerTab>
      </div>

      {tab === "profile" && (
        <div className="inner-tab-content active">
          <div className="row two">
            <div className="card">
              <div className="account-info">
                <div className="account-ava">
                  {initials}
                  <div className="account-ava-cam" onClick={() => toast("Upload photo")}>📷</div>
                </div>
                <div className="account-info-body">
                  <h2 className="account-name">{fullName}</h2>
                  <div className="account-info-line"><span className="account-info-lbl">Date of birth:</span> Aug 14, 1985</div>
                  <div className="account-info-line"><span className="account-info-lbl">Email:</span> mike@example.com</div>
                  <div className="account-info-line"><span className="account-info-lbl">Phone:</span> (305) 555-0142</div>
                </div>
              </div>
              <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
                <button className="btn btn-secondary" onClick={() => toast("Change password form opened")}>Change password</button>
                <button className="btn btn-primary" onClick={() => openModal("editProfile")}>Edit information</button>
              </div>
            </div>
            <div className="card">
              <div style={{ marginBottom: 22 }}>
                <div className="form-label" style={{ marginBottom: 8 }}>Language</div>
                <select className="account-select" defaultValue="English">
                  <option>English</option>
                  <option>Español</option>
                </select>
              </div>
              <div>
                <div className="form-label" style={{ marginBottom: 10 }}>Theme</div>
                <div className="theme-toggle">
                  <button className={`theme-opt ${theme === "dark" ? "active" : ""}`} onClick={() => { setTheme("dark"); toast("Theme: dark"); }}>🌙</button>
                  <button className={`theme-opt ${theme === "light" ? "active" : ""}`} onClick={() => { setTheme("light"); toast("Theme: light"); }}>☀️</button>
                </div>
              </div>
            </div>
          </div>
          <HelpCard />
        </div>
      )}

      {tab === "billing" && (
        <div className="inner-tab-content active">
          <div className="card-h" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>💳 Payment method</span>
          </div>
          <button onClick={onUpdateCard} style={{ width: "100%", cursor: "pointer", padding: "16px 18px", background: "#fff", border: "1.5px solid var(--border)", borderRadius: 14, marginBottom: 12, display: "flex", alignItems: "center", gap: 14 }}>
            <span className="brand-chip">{cardLast4 ? "CARD" : "VISA"}</span>
            <div style={{ flex: 1, textAlign: "left" }}>
              {cardLast4
                ? <>
                    <div style={{ fontSize: 14.5, fontWeight: 600 }}>Card ending •••• {cardLast4}</div>
                    <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>Used for your subscription. Tap to update.</div>
                  </>
                : <>
                    <div style={{ fontSize: 14.5, fontWeight: 600 }}>Update card on file</div>
                    <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>Enter a new card on our processor&apos;s secure page.</div>
                  </>}
            </div>
            <span style={{ color: "var(--muted)", fontSize: 16 }}>✏️</span>
          </button>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 30, display: "flex", alignItems: "center", gap: 6 }}>
            🔒 Card details are entered on our payment provider&apos;s secure page — never stored on our servers.
          </div>

          <div className="card-h">📍 Shipping &amp; billing address</div>
          <button onClick={() => openModal("editAddress")} style={{ width: "100%", cursor: "pointer", padding: "16px 18px", background: "#fff", border: "1.5px solid var(--border)", borderRadius: 14, marginBottom: 30, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>1234 Ocean Drive, Apt 4B</div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>Opa-locka, FL 33054</div>
            </div>
            <span style={{ color: "var(--muted)", fontSize: 16 }}>✏️</span>
          </button>

          <div className="card-h">🕒 Payment history</div>
          <div className="card">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <PayRow title="Quarterly subscription" meta="Jun 1, 2026 · INV-2845" border />
              <PayRow title="Initial subscription" meta="Mar 12, 2026 · INV-2104" />
            </div>
          </div>
          <HelpCard />
        </div>
      )}

      {tab === "phi" && (
        <div className="inner-tab-content active">
          <div className="row two">
            <div className="phi-card">
              <div className="phi-card-title">Protected Healthcare Information</div>
              <div className="phi-card-desc">You can view and download all your past doctor consultations for your personal records.</div>
              <div className="phi-actions">
                <button className="btn btn-secondary" onClick={() => toast("PHI data downloaded as PDF")}>☁ Download data</button>
                <button className="btn btn-primary" onClick={() => toast("PHI viewer opened")}>View data</button>
              </div>
            </div>
            <div className="phi-card">
              <div className="phi-card-title">Data Deletion</div>
              <div className="phi-card-desc">Request deletion of personal data. We&apos;ll review and securely delete it in compliance with privacy laws.</div>
              <div className="phi-actions">
                <button className="btn btn-secondary" style={{ width: "100%" }} onClick={() => openModal("deletePhi")}>Request data deletion</button>
              </div>
            </div>
          </div>
          <HelpCard />
        </div>
      )}
    </section>
  );
}
function HelpCard() {
  return (
    <div className="help-card">
      <div className="help-ico">➕</div>
      <div>
        <div className="help-title">Help &amp; Support</div>
        <div className="help-desc">Get answers by reaching out to our care team, or share your feedback to help us improve.</div>
      </div>
    </div>
  );
}
function PayRow({ title, meta, border }: { title: string; meta: string; border?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: border ? "1px solid var(--border)" : undefined }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{meta}</div>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span className="pill active">Paid</span>
        <div style={{ fontSize: 14, fontWeight: 700 }}>$499.00</div>
      </div>
    </div>
  );
}

/* ── MODALS ── */
const PORTAL_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

function AddressVerify({ initialStreet, initialApt, initialCity, initialState, initialZip, onSaved, onCancel }: {
  initialStreet: string; initialApt: string; initialCity: string; initialState: string; initialZip: string; onSaved: () => void; onCancel: () => void;
}) {
  const [street, setStreet] = useState(initialStreet);
  const [apt, setApt] = useState(initialApt);
  const [city, setCity] = useState(initialCity);
  const [stateV, setStateV] = useState(initialState);
  const [zip, setZip] = useState(initialZip);
  const [res, setRes] = useState<UspsValidateResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [sug, setSug] = useState<AddressSuggestion[]>([]);
  const [showSug, setShowSug] = useState(false);
  const sugTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function verifyWith(input: UspsValidateInput) {
    setBusy(true);
    const r = await validateAddress(input);
    setRes(r); setBusy(false);
  }
  function verify() {
    if (!street.trim()) { setRes({ status: "error", dpv: null, address: null, corrections: [], warnings: [], vacant: false, changed: false, message: "Enter a street address first.", source: "mock" }); return; }
    verifyWith({ streetAddress: street, secondaryAddress: apt, city, state: stateV, ZIPCode: zip });
  }
  function onStreet(v: string) {
    setStreet(v); setRes(null);
    if (sugTimer.current) clearTimeout(sugTimer.current);
    if (v.trim().length >= 3) { sugTimer.current = setTimeout(async () => { setSug(await fetchSuggestions(v, stateV)); setShowSug(true); }, 200); }
    else { setSug([]); setShowSug(false); }
  }
  function pick(s: AddressSuggestion) {
    setStreet(cleanStreet(s.street)); setApt(s.secondary || apt); setCity(s.city); setStateV(s.state); setZip(s.zip);
    setSug([]); setShowSug(false);
    verifyWith({ streetAddress: s.street, secondaryAddress: s.secondary, city: s.city, state: s.state, ZIPCode: s.zip });
  }
  function apply() {
    if (!res?.address) return;
    const a = res.address;
    setStreet(cleanStreet(a.streetAddress));
    setApt(a.secondaryAddress || apt);
    setCity(a.city); setStateV(a.state); setZip(a.ZIPPlus4 ? `${a.ZIPCode}-${a.ZIPPlus4}` : a.ZIPCode);
    setRes({ ...res, changed: false, status: res.dpv === "Y" ? "verified" : res.status, message: res.dpv === "Y" ? "Address verified — deliverable by USPS." : res.message });
  }
  const tone = res ? ({ verified: "#2e7d54", corrected: "#3a7ab0", needs_secondary: "#b86e1e", unverified: "#b8412a", error: "#b8412a" } as Record<string, string>)[res.status] : "";

  return (
    <>
      <div className="form-grid" style={{ marginBottom: 12, gridTemplateColumns: "2fr 1fr" }}>
        <div className="form-field" style={{ position: "relative" }}>
          <div className="form-label">Street address</div>
          <input className="form-input" value={street} placeholder="Start typing your address…" autoComplete="off"
            onChange={(e) => onStreet(e.target.value)}
            onFocus={() => { if (sug.length) setShowSug(true); }}
            onBlur={() => setTimeout(() => setShowSug(false), 150)} />
          {showSug && sug.length > 0 && (
            <div style={{ position: "absolute", zIndex: 50, left: 0, right: 0, top: "100%", marginTop: 4, background: "#fff", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "0 10px 30px rgba(20,30,50,.18)", overflow: "hidden" }}>
              {sug.map((s, i) => (
                <button type="button" key={i} onMouseDown={() => pick(s)} style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", fontSize: 12.5, background: "transparent", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer" }}>
                  <span style={{ fontWeight: 600 }}>{s.street}</span><span style={{ color: "var(--muted)" }}>, {s.city}, {s.state} {s.zip}</span>
                </button>
              ))}
            </div>
          )}
          <div style={{ marginTop: 5 }}><AddressLookupBadge /></div>
        </div>
        <div className="form-field">
          <div className="form-label">Apt / Suite / Unit</div>
          <input className="form-input" value={apt} placeholder="Apt 4B (optional)" onChange={(e) => { setApt(e.target.value); setRes(null); }} />
        </div>
      </div>
      <div className="form-grid" style={{ marginBottom: 12 }}>
        <div className="form-field"><div className="form-label">City</div><input className="form-input" value={city} onChange={(e) => { setCity(e.target.value); setRes(null); }} /></div>
        <div className="form-field"><div className="form-label">State</div>
          <select className="form-input" value={stateV} onChange={(e) => { setStateV(e.target.value); setRes(null); }}>{PORTAL_STATES.map((s) => <option key={s}>{s}</option>)}</select></div>
      </div>
      <div className="form-field" style={{ marginBottom: 12 }}>
        <div className="form-label">ZIP code</div>
        <input className="form-input" value={zip} onChange={(e) => { setZip(e.target.value); setRes(null); }} />
      </div>
      <button className="btn btn-secondary" style={{ width: "100%", marginBottom: res ? 12 : 0 }} onClick={verify} disabled={busy}>{busy ? "Verifying…" : "📍 Verify address with USPS"}</button>
      {res && (
        <div style={{ border: `1px solid ${tone}`, background: "#fff", borderRadius: 12, padding: "12px 14px", fontSize: 13 }}>
          <div style={{ fontWeight: 700, color: tone, marginBottom: 4 }}>
            {res.status === "verified" && "✓ Address verified"}
            {res.status === "corrected" && "✎ USPS standardized this address"}
            {res.status === "needs_secondary" && "⚠ Needs apartment / suite / unit"}
            {(res.status === "unverified" || res.status === "error") && "✕ Could not verify"}
          </div>
          <div style={{ color: "var(--muted)" }}>{res.message}</div>
          {res.address && (res.changed || res.status === "corrected") && (
            <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: "#f6f8fb", border: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 600 }}>{res.address.streetAddress}{res.address.secondaryAddress ? `, ${res.address.secondaryAddress}` : ""}</div>
              <div style={{ color: "var(--muted)" }}>{res.address.city}, {res.address.state} {res.address.ZIPCode}{res.address.ZIPPlus4 ? `-${res.address.ZIPPlus4}` : ""}</div>
              <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={apply}>Use this address</button>
            </div>
          )}
          {res.corrections.map((c, i) => <div key={i} style={{ marginTop: 4, color: "var(--muted)" }}>• {c}</div>)}
          {res.warnings.map((w, i) => <div key={i} style={{ marginTop: 4, color: "#b86e1e" }}>⚠ {w}</div>)}
          <div style={{ marginTop: 6, fontSize: 11, color: "var(--muted)" }}>{res.source === "usps" ? "Verified via USPS Addresses API" : "Demo validator (add USPS credentials to validate live)"}</div>
        </div>
      )}
      <div className="modal-foot">
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={onSaved}>Save</button>
      </div>
    </>
  );
}

function PortalModal({ type, onClose, toast, weightDraft, setWeightDraft, saveWeight, onAddShot }: {
  type: ModalType; onClose: () => void; toast: (s: string) => void;
  weightDraft: string; setWeightDraft: (s: string) => void; saveWeight: () => void;
  onAddShot: (entry: Omit<ShotEntry, "id">) => void;
}) {
  function close(msg?: string) { onClose(); if (msg) toast(msg); }
  // Pre-fill date/time to "now" for the Add dose modal.
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const nowTimeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  // Controlled fields for the Add dose form so we can save what's entered.
  const [shotDate, setShotDate] = useState(todayStr);
  const [shotMed, setShotMed] = useState("");
  const [shotUnit, setShotUnit] = useState("mg");
  const [shotStrength, setShotStrength] = useState("");
  const [shotSite, setShotSite] = useState("Stomach - Upper Left");

  function submitShot() {
    if (!shotMed) { toast("Please select a medication"); return; }
    onAddShot({
      date: shotDate || todayStr,
      medication: shotMed,
      unit: shotUnit,
      strength: shotStrength || "—",
      site: shotSite,
    });
  }
  return (
    <div className="modal-backdrop show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        {type === "refill" && (<>
          <div className="modal-h">Request a refill</div>
          <div className="modal-sub">Your next scheduled refill is Jul 3, 2026. Request one now if you&apos;re running low.</div>
          <div className="modal-body">
            <div className="form-field" style={{ marginBottom: 12 }}>
              <div className="form-label">Reason</div>
              <select className="form-input" defaultValue="Running low">
                <option>Running low</option><option>Lost or damaged supply</option><option>Traveling - need extra</option>
              </select>
            </div>
          </div>
          <div className="modal-foot">
            <button className="btn btn-secondary" onClick={() => close()}>Cancel</button>
            <button className="btn btn-primary" onClick={() => close("Refill requested")}>Submit request</button>
          </div>
        </>)}
        {type === "pause" && (<>
          <div className="modal-h">Pause your subscription</div>
          <div className="modal-sub">We&apos;ll skip your next shipment and billing. You can resume anytime.</div>
          <div className="modal-foot">
            <button className="btn btn-secondary" onClick={() => close()}>Keep active</button>
            <button className="btn btn-primary" onClick={() => close("Subscription paused")}>Pause</button>
          </div>
        </>)}
        {type === "cancel" && (<>
          <div className="modal-h">Cancel your subscription</div>
          <div className="modal-sub">Cancellation takes effect at the end of your current billing cycle (Sep 12, 2026).</div>
          <div className="modal-foot">
            <button className="btn btn-secondary" onClick={() => close()}>Keep my plan</button>
            <button className="btn btn-danger" onClick={() => close("Cancellation scheduled")}>Cancel subscription</button>
          </div>
        </>)}
        {type === "logWeight" && (<>
          <div className="modal-h">Log this week&apos;s weight</div>
          <div className="modal-sub">Take your weight on a consistent day, ideally in the morning.</div>
          <div className="modal-body">
            <div className="form-field">
              <div className="form-label">Current weight (lbs)</div>
              <input className="form-input" type="number" placeholder="e.g. 195" autoFocus value={weightDraft} onChange={(e) => setWeightDraft(e.target.value)} />
            </div>
          </div>
          <div className="modal-foot">
            <button className="btn btn-secondary" onClick={() => close()}>Cancel</button>
            <button className="btn btn-primary" onClick={saveWeight}>Save</button>
          </div>
        </>)}
        {type === "logShot" && (<>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "22px 26px 8px" }}>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>Add dose</div>
            <button onClick={() => close()} aria-label="Close" style={{ border: "none", background: "none", cursor: "pointer", fontSize: 22, lineHeight: 1, color: "var(--muted)" }}>✕</button>
          </div>
          <div className="modal-sub">We have pre-filled the dose details for you. Please review and edit if necessary.</div>
          <div className="modal-body">
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="form-grid">
                <div className="form-field">
                  <div className="form-label">Date</div>
                  <input className="form-input" type="date" value={shotDate} onChange={(e) => setShotDate(e.target.value)} />
                </div>
                <div className="form-field">
                  <div className="form-label">Time</div>
                  <input className="form-input" type="time" defaultValue={nowTimeStr} />
                </div>
              </div>
              <div className="form-field">
                <div className="form-label">Medication</div>
                <select className="form-input" value={shotMed} onChange={(e) => setShotMed(e.target.value)}>
                  <option value="" disabled>Select medication</option>
                  {MEDICATIONS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-field">
                <div className="form-label">Dosage unit</div>
                <select className="form-input" value={shotUnit} onChange={(e) => setShotUnit(e.target.value)}>
                  {DOSAGE_UNITS.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div className="form-field">
                <div className="form-label">Dosage strength</div>
                <input className="form-input" type="number" placeholder="e.g. 0.5" value={shotStrength} onChange={(e) => setShotStrength(e.target.value)} />
              </div>
              <div className="form-field">
                <div className="form-label">Injection site</div>
                <select className="form-input" value={shotSite} onChange={(e) => setShotSite(e.target.value)}>
                  {INJECTION_SITES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="modal-foot">
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={submitShot}>Add dose</button>
          </div>
        </>)}
        {type === "editProfile" && (<>
          <div className="modal-h">Edit profile information</div>
          <div className="modal-body">
            <div className="form-grid">
              <Fld label="First name" val="Michael" /><Fld label="Last name" val="Gromadzki" />
              <Fld label="Email" val="mike@example.com" /><Fld label="Phone" val="(305) 555-0142" />
            </div>
          </div>
          <div className="modal-foot">
            <button className="btn btn-secondary" onClick={() => close()}>Cancel</button>
            <button className="btn btn-primary" onClick={() => close("Profile updated")}>Save</button>
          </div>
        </>)}
        {type === "editAddress" && (<>
          <div className="modal-h">Edit shipping address</div>
          <div className="modal-body">
            <AddressVerify initialStreet="1234 Ocean Drive" initialApt="Apt 4B" initialCity="Opa-locka" initialState="FL" initialZip="33054" onSaved={() => close("Address updated")} onCancel={() => close()} />
          </div>
        </>)}
        {type === "deletePhi" && (<>
          <div className="modal-h" style={{ color: "var(--red)" }}>Request data deletion</div>
          <div className="modal-sub">We&apos;ll review your request and securely delete your personal data within 30 days, in compliance with privacy laws. This cannot be undone.</div>
          <div className="modal-foot">
            <button className="btn btn-secondary" onClick={() => close()}>Cancel</button>
            <button className="btn btn-danger" onClick={() => close("Deletion request submitted")}>Request deletion</button>
          </div>
        </>)}
      </div>
    </div>
  );
}
function Fld({ label, val }: { label: string; val: string }) {
  return (
    <div className="form-field">
      <div className="form-label">{label}</div>
      <input className="form-input" defaultValue={val} />
    </div>
  );
}

/* ── Toasts ── */
function ToastStack({ toasts }: { toasts: { id: number; text: string }[] }) {
  return (
    <div className="toast-stack">
      {toasts.map((t) => <div key={t.id} className="toast-item">{t.text}</div>)}
    </div>
  );
}
