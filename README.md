# DripVitals — Next.js Scaffold

Production scaffold of the DripVitals telehealth platform, ported from the single-file HTML build.

## Tech stack

- **Next.js 15** (App Router) + React 19
- **TypeScript** strict mode
- **Tailwind CSS 3** with the Healthie-mint design system encoded as Tailwind tokens (`tailwind.config.ts`)
- **Inter + DM Mono** via `next/font/google` (no external CDN)
- **Mini-zustand store** (`lib/hooks/zustand-shim.ts`) — drop-in replacement for the real `zustand` if you decide to add it later

## Getting started

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000). You'll land on the dashboard.

## Project structure

```
app/
  layout.tsx              Root layout — fonts, body shell
  page.tsx                Redirects to /dashboard
  globals.css             Tailwind directives + design-token utilities (.btn, .pill, .card, .toggle, .fi, .fl…)
  (modules)/
    layout.tsx            Topbar + Sidebar wrapper for all module pages
    dashboard/page.tsx    ✅ Fully implemented
    patients/page.tsx     ✅ Fully implemented (list + filters + search)
    patients/[id]/page.tsx ✅ Fully implemented (detail view)
    queue/page.tsx        🚧 Placeholder
    soap/page.tsx         🚧 Placeholder
    rx/page.tsx           🚧 Placeholder
    ... (27 stub modules — see sidebar for full list)
  api/                    (empty — for future route handlers)

components/
  layout/Topbar.tsx       Breadcrumb-aware top bar
  layout/Sidebar.tsx      31-route sidebar with section grouping and active-route highlighting
  ui/Pill.tsx             Semantic status pill (10 intent colors)
  ui/Kpi.tsx              KPI card + grid
  ui/Modal.tsx            ESC-aware modal with backdrop click
  ui/Toast.tsx            Global toast renderer
  modules/ModulePlaceholder.tsx   Stub used by every unbuilt route

lib/
  data/patients.ts        Seeded patient array (8 records, all status types)
  types/index.ts          Patient, Visit, Order, Prescription type definitions
  hooks/useToast.ts       toast(msg) — fire-and-forget toast API
  hooks/zustand-shim.ts   ~30-line zustand-shaped store
```

## Design tokens

All colors, shadows, fonts, and radii are defined in `tailwind.config.ts` under `theme.extend`. Available colors:

- **`bg-canvas`** (`#f7f8f6`) — page background
- **`bg-surface`, `bg-surface-2`, `bg-surface-3`, `bg-surface-4`** — card and panel backgrounds
- **`text-ink`, `text-ink-2`, `text-ink-muted`, `text-ink-muted-2`, `text-ink-faint`** — text hierarchy
- **`bg-brand`, `bg-brand-dk`, `bg-brand-md`, `bg-brand-soft`, `bg-brand-softer`** — mint brand
- **`bg-{green|amber|red|blue|purple|teal|coral|pink}`** + `-soft` variants — semantic palette

## Migration roadmap

The single-file HTML build at `dripvitals_unified.html` contains **31 view sections**. This scaffold ports them progressively:

- ✅ Dashboard (`app/(modules)/dashboard`) — KPIs, today's schedule (live-wired to visit queue), alerts
- ✅ Patients list (`app/(modules)/patients`) — search, filters, sort, pagination, KPI strip, CSV export
- ✅ **Patient Chart fully ported** (`app/(modules)/patients/[id]`) — all 10 tabs working
- ✅ Add / Edit / Delete patient — fully functional, persists across the session
- ✅ **Visit Queue** (`app/(modules)/queue`) — 5-tab filter (All/Waiting/In Progress/Completed/Urgent), KPI strip with live counts, time-sorted table, Schedule Visit modal, advance-status actions
- ✅ **Orders** (`app/(modules)/orders`) — combined Rx + Lab feed, KPI strip, 6-chip filter, search, sortable table, expandable detail rows, approve/cancel/result actions, pagination, CSV export
- ✅ **SOAP Notes** (`app/(modules)/soap`) — 3-column clinical note editor: notes list + filter + search (left rail), full S/O/A/P editor with templates + sign & lock workflow (center), live patient context with vitals + plan + allergies (right rail)
- ✅ **e-Prescribe (Rx)** (`app/(modules)/rx`) — 4 KPIs, 6-chip filter, search, sortable table, drug interaction flags with red row treatment, expandable detail rows with sig/days-supply/qty, send refill (decrements counter), renew (creates fresh Rx), approve pending, cancel, CSV export, New Prescription modal
- ✅ **Secure Messaging** (`app/(modules)/messaging`) — 2-column inbox layout with folder filters (All/Unread/Pinned/Patients/Pharmacy/Staff), search across threads + message bodies, live thread state (send/reply auto-scrolls), pin/unread/archive actions, compose New Message modal for patient/staff/pharmacy threads
- ✅ **Inventory Management** (`app/(modules)/inventory`) — 5 KPIs, critical reorder alert banner, filter chips by status + category, search, table with colored stock-level bars, real reorder modal with cost estimate + ETA, receive-pending action that adds on-order qty back to stock, CSV export
- ✅ **Labs & Orders** (`app/(modules)/labs`) — 4 KPIs, critical value alert banner with specific patient/test/value, filter chips, search, sortable table with priority/fasting flags, expandable detail showing full results breakdown with reference ranges + colored flag pills, acknowledge-critical action, Order Labs modal with panel picker + STAT priority + fasting toggle, CSV export
- ✅ **Staff & Roles** (`app/(modules)/staff`) — 3-tab layout: Team Members (card grid with expand-to-detail + license badges), Roles & Permissions (4 role cards with permission pills + active count), Security Policy (toggle switches); KPI strip with provider/care-team/admin counts; license expiry alert banner + dedicated license tracker table; Invite Staff modal with role-aware NPI requirement
- ✅ **Partner Pharmacies** (`app/(modules)/pharmacies`) — 4 KPIs, status filter chips, search, 2-col card grid with mini metrics (turnaround/SKUs/monthly/success rate), expandable detail showing API config, contact info, performance metrics, live SKU breakdown from inventory store, recent orders from orders store, test connection + pause/resume + remove actions, Add Pharmacy modal
- ✅ **Task Manager** (`app/(modules)/tasks`) — 4-column kanban (To Do / In Progress / In Review / Done) with **real HTML5 drag-and-drop**, KPI strip (open/urgent/overdue/completed), staff filter, search, expandable task cards with priority bars + patient deep-links, move-to-column quick actions, New Task modal with column-aware default status
- ✅ **Analytics** (`app/(modules)/analytics`) — 5-KPI strip, custom SVG revenue bar chart with brand→violet gradient + gridlines + value labels, Revenue by Plan with progress bars (derived live from patient roster + subscription prices), Patient Outcomes panel with stacked lab-results bar, Provider Performance leaderboard, Top Medications ranking, Today's Visit Mix tiles, date-range selector, CSV export of all metrics
- ✅ **Billing & Insurance** (`app/(modules)/billing`) — 5 KPIs (claims + paid total + pending total + denied + clean rate), payer breakdown strip with per-payer paid percentages, 4 tabs (All / Pending / Denied / Prior Auth), search across claim ID/patient/payer/CPT/ICD-10, claims table with expandable EOB-style detail breakdown, denial callout with code + reason, real resubmit workflow (flips back to pending), 47 seeded claims + 6 prior auths, Submit Claim modal (CPT picker + payer + ICD-10), Verify Insurance flow (270/271 EDI simulation), CSV export
- ✅ **Subscriptions** (`app/(modules)/subscriptions`) — 4 KPIs with live MRR / ARPU / Churn calculations, MRR breakdown card by billing cycle, status tabs (Active / Paused / Cancelled / All), plan filter chips, expandable detail showing Stripe IDs + revenue metrics (Total Paid / Payments Made / Monthly Contrib / Projected LTV), real pause/resume/cancel workflows wired through Zustand, New Subscription modal with plan presets, CSV export
- ✅ **Notifications** (`app/(modules)/notifications`) — 4 KPIs (active rules / sent today / failed / quiet hours), delivery channel status strip (Email/SMS/Push/In-app with provider names), 4 tabs (Clinical / Patient / Staff / Delivery Log), 16 configurable notification rules with per-channel toggle pads (visual on/off state), bulk "All/Off" per rule, quiet hours config with start/end time + urgent-bypass, delivery log table with retry-on-fail action
- ✅ **Audit Log** (`app/(modules)/audit-log`) — 4 KPIs (Total / PHI Accesses / Security Alerts / Failures), HIPAA §164.312(b) compliance banner, 6 category filter chips with icons + live counts, date-range selector, search across user/action/patient/IP/event ID, 250 seeded deterministic events, paginated table (50/page), expandable detail showing Event ID + IP + user agent + integrity hash (SHA-256 chain), append-only store enforcement (no edit/delete), CSV export with full event metadata
- ✅ **Reviews & NPS** (`app/(modules)/reviews`) — 5 KPIs with live NPS calculation, NPS breakdown bar with clickable segment filters (Promoters/Passives/Detractors), star rating breakdown with clickable filters, reply-status filter chips, search, review cards with star rating + NPS pill + provider attribution + reply thread, **inline reply composer** wired to store, flag/unflag with reason, Send Survey modal (audience picker + template + channel), CSV export
- ✅ **Affiliate Program** (`app/(modules)/affiliate`) — 5 KPIs with live conversion-rate math, 🥇🥈🥉 Top Performers leaderboard, type filter chips (Influencer / Doctor / Health Coach / Podcast / Press) + status dropdown, search, table with click-to-copy promo codes + commission cells, expandable detail showing lifetime stats grid + editable commission rate + payout history table (Stripe/PayPal/Wire/Check), pay-commission modal that records a real payout and zeroes pending balance, pause/resume/activate workflows, New Affiliate modal with auto-suggested promo code, CSV export
- ✅ **Marketing** (`app/(modules)/marketing`) — 4 KPIs with live open/click/conversion rates computed across all campaigns, 4 tabs (Campaigns / Automations / Templates / Segments), campaign table with status filter chips + computed open/click rates per row, expandable detail showing **visual conversion funnel** (Sent → Delivered → Opens → Clicks → Conversions) with step-over-step percentages + performance metrics + CPA, automation cards with completion progress bars, template card grid with usage counts + "Use this template" CTA, segment cards with member counts + Campaign deep-link, New Campaign modal with channel picker + audience + template starter + draft/launch toggle, CSV export, pause/resume workflows
- ✅ **Treatments & Intake Forms** (`app/(modules)/treatments`) — 2 sub-tabs (Treatments / Intake Forms); Treatments tab has 5 KPIs (Total / Featured / Compounded / Active Patients / MRR contrib), filter chips + search, responsive card grid with expandable detail showing eligibility (BMI/age/screening) + perks list + contraindications block + linked intake form; Forms tab has 4 KPIs (Total / Submissions / Completion % / Avg minutes), form rows showing public URL + completion rate bar + assigned treatment pills; **patient-eye preview modal** renders the full intake form as it would appear to leads (text inputs, yes/no buttons, single/multi choice, with disqualifying answer flags); status toggles (active/inactive, featured/unfeatured, draft/active)
- ✅ **Knowledge Base** (`app/(modules)/knowledge`) — Mint hero search card spanning title/content/tags/author, 7 category tiles (All / 🩺 Clinical / ⚙ Ops / 📋 Compliance / 💳 Billing / ❓ FAQ / 🔗 Integrations) with live counts and color-coded active state, 4 KPIs (Total / Views / Helpful Rate / Pinned), sort dropdown (Recent / Popular / Alpha), pinned articles float to top with violet left-border, article rows showing author avatar + preview + category + view count + helpful % + tags, **click-to-read article reader** with full body (paragraph/bold rendering), thumbs-up/down feedback wired to store, view counter increments on open, pin/publish/edit/archive actions, 24 seeded articles spanning real clinical SOPs (GLP-1 dose escalation, side-effect triage, BMI thresholds) + operations workflows + HIPAA compliance + denial code resolutions + 5 patient-facing FAQs
- ✅ **Referral Management** (`app/(modules)/referrals`) — 5 KPIs (Total / Pending / Scheduled / Completed / Incoming), STAT alert banner, 6 tabs (All / Pending / Scheduled / Completed / Incoming / 🏥 Directory), urgency filter chips with color-coded active state (Routine / Urgent / STAT), search across patient/specialist/reason, 28 deterministic referrals + 7-specialist directory across 7 specialties, sorted by urgency-then-date, STAT rows get red left-border + tinted background, expandable detail showing specialist card with full contact info + auth status + clinical notes + specialist findings (when completed), one-click Schedule (next week) + Mark Completed + Cancel workflows, **Specialist Directory** tab with sortable cards showing in-network payer pills, response time, accepting-new status, notes, and "+ Refer" deep-link to New Referral modal
- ✅ **Patient Portal** (`app/(modules)/portal`) — Staff preview banner with patient selector dropdown, **gradient hero card** showing patient avatar + name + program week + 3 progress stats (weight loss / current dose / adherence streak) + progress-to-goal bar with gradient fill, 5 paired-column sections: Action Needed (consent/refill/check-in) + My Vitals (4-cell grid + 12-week weight sparkline), Upcoming Visit + Active Medications, Recent Labs + Care-Team Messages, Patient FAQs from Knowledge Base + Subscription & Billing card with last invoice + pause/update card actions; everything wired live to existing patient store and PatientExtra synthesizer
- ✅ **Integrations Hub** (`app/(modules)/integrations`) — 4 KPIs (Total / Connected / Errors / Monthly Spend), **errored-integrations banner with "Fix All" one-click reconnect**, "Test All" button that simulates a 1.2s health check sweep, category filter chips with live counts (9 categories), 14 seeded integrations rendered as cards with status pills + usage strings + click-to-expand detail showing endpoint URL, masked API key with copy/rotate actions, receiving webhook URL, last sync, monthly cost, setup date, docs link, plus test/configure/reconnect/disconnect actions; outgoing webhooks table at the bottom with endpoint URL + event tags + success rate + total calls + Test/Pause/Remove actions, HMAC-SHA256 signing footer note
- ✅ **Video Visits** (`app/(modules)/video`) — HIPAA-secure telehealth view with **"Next Up" gradient hero card** (urgent = red gradient, in-progress = blue gradient, normal = mint) showing the next imminent visit with a prominent white Join Room CTA, 4 KPIs (Today / Avg Duration / Completion Rate / This Month), provider filter chips with per-provider visit counts, **2-column layout** with today's chronological schedule on the left (urgent + in-progress rows get colored left-borders + tinted backgrounds, completed rows fade out) and sidebar on the right showing telehealth device pre-check (mic/camera/network/speakers) + HIPAA compliance checklist (BAA · E2E encryption · recording policy · state licensure) + weekly stats; pre-visit modal with 6-item checklist (identity verified, vitals reviewed, meds reviewed, consent current, questionnaire, SOAP template) + deep-links to patient chart and SOAP note; one-click Join Room flips status to in-progress, End Visit completes and routes to SOAP
- ✅ **Settings** (`app/(modules)/settings`) — 8-tab sidebar layout (Practice Profile / Branding / Team & Roles / Notifications / Security & SSO / Plan & Billing / Compliance / ⚠ Danger Zone) with per-tab Save button; Practice Profile (NPI/EIN/address/hours/timezone), Branding (color picker + logo upload + portal domain + email signature), Team Roles (4-cell team summary + full role permissions matrix), Notifications (delivery channels + periodic reports + quiet hours), Security (2FA, IP allowlist, session/password policy, SSO with provider picker), Plan & Billing (gradient plan card + included features + integration spend + payment method + invoice history), Compliance (HIPAA verification banner + safeguard toggles with "Required" pills + audit retention + 6 downloadable documents), Danger Zone (red-bordered with data export + ownership transfer + confirm-modal-guarded delete practice action); also added a new "Settings" sidebar nav entry under Admin
- ✅ **Consent & eSign** (`app/(modules)/consent`) — Pending-signatures alert banner with "Send All Reminders" one-click batch, 4 KPIs (Active Forms / Lifetime Signed / Awaiting Signature / Compliance Rate), 2 tabs (Form Library + 🖋 Signature Audit), 6 seeded forms with realistic full legal body text (HIPAA Notice, GLP-1 Treatment Consent, Side Effects Acknowledgment with black-box warning, Telehealth Consent, Financial Agreement, Photo & Progress); form cards show signed/pending/version stats with amber border + left-stripe when pending; full-text preview modal with category pills + retention info + sample eSign block; signature audit table showing Signature ID + patient + form + version + status + date + IP/UA, status filter chips + search, mark-signed/send-reminder/void actions, void requires reason and preserves record per HIPAA §164.530; Send Consent modal with patient + form picker + 30-day expiry note + auto-reminder schedule; CSV export of audit trail
- 🎉 **All 28 modules ported. Project complete.**

To port a module, replace the stub `page.tsx` with the real implementation. Recommended order based on usage:

1. **Visit Queue** (`/queue`) — the primary "what's happening now" view
2. **SOAP Notes** (`/soap`) — clinical documentation
3. **Prescriptions** (`/rx`) — e-prescribing
4. **Orders** (`/orders`) — pharmacy fulfillment
5. **Messaging** (`/messaging`) — patient comms

## Adding the database / auth later

The `app/api/` directory is empty and ready for Next.js Route Handlers. The `lib/data/patients.ts` array exists as the only data source today — when you wire up a real database (Postgres + Drizzle/Prisma, Convex, Supabase, etc.), replace `lib/data/patients.ts` with server actions that call the database. The components import via `getPatientById(id)` so the migration is one file.

For auth, add NextAuth.js or Clerk and wrap `app/(modules)/layout.tsx` with the session guard.

## What's deliberately not done yet

- No state persistence — refreshing the page resets in-memory state (patients aren't editable yet, just viewable)
- No server actions — everything runs client-side
- No tests — set up Vitest + Playwright when you start shipping
- No CI — add GitHub Actions when you have a deploy target
