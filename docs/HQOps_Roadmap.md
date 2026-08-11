# HQOps Development Roadmap

**Version:** 1.0
**Date:** July 2026
**Status:** Committed decisions, not options.

---

## The objective, in priority order

1. **Land GrayHQ consulting/managed clients on HQOps.** GrayHQ takes on client projects and operates HQOps on their behalf. Each client gets an isolated account; GrayHQ is invited in as admin. This is the first revenue and the proof the model works.
2. **Make onboarding the next GrayHQ client fast and safe** — no rebuild per client, isolated data, repeatable setup.
3. **Open self-serve signup** at hqops.app once the platform is proven on managed clients.

Everything below sequences against that order. When a decision is ambiguous, the earlier goal wins.

### Two payment flows — don't conflate them

The word "payments" means two entirely different builds, prioritized in this order:

- **Clients collect from their customers, through HQOps** (Stripe Connect). A GrayHQ client runs their operation on HQOps and their customers pay them; money flows to the client's own bank, GrayHQ never touches it. This is a platform build. **It is NOT blocked by GrayHQ's LLC or bank account** — buildable today. This is Phase 2.
- **GrayHQ collects consulting fees from its clients** (Stripe Checkout / payment links). A client hires GrayHQ and pays GrayHQ. This is mostly NOT an HQOps feature — it's a Stripe account plus payment links against GrayHQ's own bank. **It IS blocked by the LLC** (State of IL approval pending → no business bank account yet). Parked until the LLC clears, then handled as a simple setup outside the platform. Not a dev phase — see the "Parked" section.

---

## The strategic frame: what the Workspace369 comparison taught us

Workspace369 is a five-year-old, staffed competitor solving the same problem — one system for client work instead of a stitched-together pile. They are ahead on breadth: live payments, SMS, voice, projects, accounting, inventory, a mobile app. Trying to match them feature-for-feature is a two-year slog to become a slightly-worse version of a more mature product. That race is unwinnable and it's the wrong race.

**HQOps wins on one thing they architecturally cannot do without rebuilding: multi-entity.** One operator, many businesses, unlimited users, isolated data, one bill. Their pricing is seat-based and single-org — to run four businesses on Workspace369 you pay four times and lose data isolation. That is exactly the operator HQOps serves, and it is exactly who GrayHQ's managed clients and Matt's own portfolio are.

**The discipline this roadmap enforces:** every build either (a) serves the multi-entity/managed-services wedge, or (b) closes a table-stakes gap that would embarrass HQOps in front of a prospect. Anything that only helps HQOps become a broader horizontal platform is an explicit non-goal, no matter how complete it would make the product look.

### Explicit non-goals (deliberately NOT building)

- **Voice / calling / voicemail** — a whole product surface serving horizontal breadth, not the wedge.
- **Inventory** — irrelevant to advisory, field service, or professional-services managed clients.
- **Full accounting** (AR aging, credit notes, GL) — HQOps prepares clean data for the client's existing bookkeeper; it does not replace QuickBooks. This is a selling point, not a gap.
- **Feature-parity with Workspace369** as a goal in itself.

These are revisited only if a paying managed client explicitly requires one. Not before.

---

## Phase 2 — Client payments + platform readiness (managed services)

**Goal served:** #1. This phase ends when a GrayHQ managed client can run their operation on HQOps and collect money from their own customers through the platform — regardless of vertical.

The centerpiece is Stripe Connect, because getting a client's customers paying *the client* is the thing that makes HQOps a real operational system rather than a record-keeper. It's buildable now and does not wait on GrayHQ's LLC.

### 2.1 — Stripe Connect (client collects from their customers)

A GrayHQ client's customers pay the client. GrayHQ sets up the connected Stripe account on the client's behalf as business manager; money flows to the client's bank, never through GrayHQ. **Not blocked by GrayHQ's LLC** — each connected account is the client's own.

- Stripe Connect onboarding per entity — GrayHQ configures it for the client.
- Invoice "Pay Now" and deposit collection wired to the connected account.
- Deposit-now / balance-on-completion split (matters for field-service and project work).
- Webhook handling for payment events per connected account, per entity.
- Payment status reflected back onto the invoice in the CRM and the client portal.

**Why first in the phase:** it's the highest-value, LLC-independent build that serves goal #1 directly. A client evaluating GrayHQ's managed service wants to see their customers can pay them through the system.

### 2.2 — Platform hardening for multi-client operation

The things that make HQOps safe to run as a managed service across several client accounts, drawn from the managed-services scope doc. These apply to every managed client regardless of industry.

- QuickBooks-format payroll export (clients' payroll providers need a clean import, not the generic CSV) — for any client with employees.
- Break tracking on the time clock (payroll accuracy, FLSA) — for any client with hourly staff.
- PTO / time-off requests.
- Job / project photos visible in the client portal.
- **Offline time-clock queue never replays** (found in the Aug 2026 lint
  pass). `queueOfflineAction` writes clock actions to localStorage
  (`crm:tcQueue`) to survive reload, but `flushOfflineQueue` only DELETES
  the queue — there is no replay path. Scenario: crew member clocks in
  offline → page reloads or PWA restarts → reconnects → the queued
  clock-in is deleted unread and the hours are lost. In a managed
  field-service engagement this is lost payroll and broken job costing.
  Fix: `flushOfflineQueue` must read the queue and replay each action
  against Supabase before clearing it, with a real error path if replay
  fails. Prerequisite for any field-service managed client, alongside the
  Field role.

Build the subset a given client needs when that client lands; the list above is the menu, not a mandatory block.

### 2.3 — Fix the deal_won automation trigger

Deferred from the audit. The webhook trigger is keyed to the literal `"Won"`, so it silently won't fire on field-service ("Won / Scheduled") or custom stages. Must be fixed before any won-triggered automation is built for a managed client. Small, but a correctness landmine.

### 2.4 — Field role — build before the FIRST field-service client (not before Phase 2 generally)

Crew-restricted access. A field-service client with a crew means every crew member would otherwise see every deal, invoice, and margin in the business. The Field Service add-on is marked "contact us" on the pricing page *because this doesn't exist yet*.

- Role `field` is already reserved in the account_members check constraint, not implemented.
- Field users see only: their assigned jobs, the time clock, and their own hours. No pipeline, no financials, no client list, no other crew's data.
- Non-trivial: data lives in JSON blobs in crm_store, so partial access requires a server-side path that returns only the field user's slice — client-side filtering is insufficient (the data would still reach their browser).

**Sequencing note:** with no field-service client imminent, this is NOT a Phase 2 blocker — it's a hard prerequisite for onboarding the first client with a crew. Build it when that client is real, not before. An advisory or professional-services managed client doesn't need it at all.

**Phase 2 exit criteria:** a GrayHQ managed client can be stood up on HQOps, GrayHQ operates it, and the client's customers pay them through the portal into the client's own account. Field-service-specific pieces (Field role, crew polish) come online when the first such client does.

---

## Phase 3 — GrayHQ Scale + Platform Hardening

**Goal served:** #2. Make onboarding the *second* and *third* managed client fast and safe, and close the gaps that would embarrass HQOps in front of a GrayHQ prospect or a demo.

### 3.1 — Engineering hygiene (do this early in the phase)

The AI-debugging arc surfaced that "fails gracefully" is visually identical to "works," and three AI bugs reached production undetected. Before more surface area is added:

- **ESLint config** with react/no-undef-class checking in the build. Would have caught the missing-prop crash and keyless-fetch mechanically.
- **Post-deploy integration smoke check** — one call to each external integration (Claude proxy, Google sync, Stripe) that asserts a real response, not a graceful failure.
- **Component-split of App.jsx.** It is one file past 2,500 lines and is the top technical risk to sustained development — once it exceeds what Claude Code can hold in context, AI-assisted changes get made blind. Split into logical modules with App.jsx as router/state container. Do this before Phase 4 adds five self-serve surfaces to the same file.

### 3.2 — Projects above tasks

The one Workspace369 feature gap worth closing, because "manage projects" is a baseline expectation for client work and GrayHQ engagements are multi-step. Today HQOps has flat tasks. Add a project layer: a project contains tasks, has an owner, a status, and a client. Not a full PM tool — just enough that a multi-step client engagement has a home.

**Wedge test:** passes. Every managed client and every GrayHQ engagement is project-shaped.

### 3.3 — Cross-entity roll-up reporting

The reporting only Workspace369 (and everyone else) structurally cannot do, because nobody else is multi-entity. A GrayHQ view across all managed client accounts: which clients are drifting, quotes unsent, invoices aging, deals with no next step. This is the "workspace health" feature the Reddit research rated 10/10 for managers — reframed as GrayHQ monitoring its book of managed clients. Directly monetizable, uniquely possible.

### 3.4 — Managed-client onboarding runbook + templates

Make client #2 and #3 fast: saved configuration templates per vertical (landscaping, advisory, property, professional services) so a new managed account is stood up in hours, not the 4-week build Juan's took.

### 3.5 — Google verification (CASA) — decision point, not a commit

Email/calendar sync is capped at 100 users and shows an unverified-app warning until a CASA assessment ($500-4,500/yr, several weeks). **Decision:** defer until self-serve (Phase 4) is genuinely close. Managed clients are onboarded by GrayHQ, who can click through the warning; the cap and warning only block *self-serve* email sync. No spend until Phase 4 is committed.

---

## Phase 4 — Self-Serve

**Goal served:** #3. Open the doors to strangers signing up at hqops.app without GrayHQ in the loop.

Only start this phase when the platform is proven on real managed clients. Self-serve to strangers before the product is battle-tested on hand-held clients is how you get churn and support load you can't yet absorb.

### 4.1 — Stripe Checkout (customer pays GrayHQ for HQOps)

The *other* Stripe integration — subscription billing for self-serve plans. Now it's on the critical path, because it wasn't before.

- Stripe Checkout for the Solo / Studio / Portfolio tiers.
- Subscription status per account; plan gating in the storage adapter.
- **Trial-end enforcement** — the FAQ promises read-only after an unpaid trial; nothing enforces it. Build the expired-account read-only state.

### 4.2 — Google CASA assessment

Now justified. Unlocks email/calendar sync as a self-serve feature and removes the user cap and warning.

### 4.3 — Self-serve onboarding polish

The starter-seed already gives a clean workspace. Add a guided first-run, and turn the vertical templates from 3.4 into self-serve "what kind of business?" setup.

### 4.4 — Marketing site depth (from the Workspace369 study)

- **Comparison pages** — "HQOps vs HubSpot," "vs Jobber," "vs Bonsai." SEO plus sales enablement; it's how people shopping for exactly this find you. Lead every one with the multi-entity angle nobody else has.
- **Live-workspace ticker** on the landing page — the lifecycle-in-motion element Workspace369 uses (request → scheduled → invoiced → paid). Matches the day-in-the-life structure the demo script already uses.
- **Changelog + roadmap pages** — the posture of a product that expects to be evaluated.

---

## Parked — waiting on an external unblock (not a dev phase)

**GrayHQ collects consulting fees from its clients.** When a client hires GrayHQ for a project and pays GrayHQ directly. This is *not* an HQOps platform build — it's a Stripe account plus payment links (or Stripe Checkout) running against GrayHQ's own business bank account.

- **Blocked by:** State of IL LLC approval for GrayHQ Consulting LLC is pending → no business bank account yet → no Stripe account to receive funds.
- **When unblocked:** set up GrayHQ's Stripe account, generate payment links or a simple hosted checkout, send them with consulting invoices. A day of setup, not a dev phase.
- **Do not** entangle this with the platform's Stripe Connect work (Phase 2) or the self-serve Stripe Checkout work (Phase 4). It's a third, separate use of Stripe against GrayHQ's own books.

Revisit the moment the LLC clears and the bank account exists.

---

## Deferred indefinitely (the maybe-someday list)

Not scheduled. Pulled forward only if a paying client asks.

- **SMS / texting (Twilio)** — the one horizontal feature with a real use case (field-service clients whose customers text). Roadmap it under Field Service; build when a managed client needs it.
- **Native mobile app (Capacitor)** — the Vite+React base makes this viable, and both developer accounts exist. But PWA covers 90% of the crew's need (home-screen time clock), and native is a maintenance commitment. Revisit when self-serve volume justifies it.
- **Quote → invoice conversion** — convenience, not a gap.
- **Multicurrency, contract lifecycle status** — from the Planify comparison; nice, not load-bearing.
- Batch 3 cosmetic audit items (C2, C3).

---

## The one-line version

**Phase 2:** Client payments — Stripe Connect (clients collect from their customers), platform hardening, deal_won fix. Field role when the first field-service client is real.
**Phase 3:** GrayHQ scales — hygiene (ESLint, App.jsx split), projects, cross-entity reporting, onboarding templates.
**Phase 4:** Self-serve opens — Stripe Checkout (customers pay GrayHQ for HQOps), CASA, marketing depth.
**Parked:** GrayHQ's own consulting billing — waiting on IL LLC + bank account, then a day of Stripe setup outside the platform.
**Never:** voice, inventory, accounting, feature-parity for its own sake.

Three separate uses of Stripe, don't conflate them: clients collecting from their customers (Phase 2, Connect), GrayHQ billing its consulting clients (Parked, LLC-blocked), and customers paying GrayHQ for HQOps self-serve (Phase 4, Checkout).

The wedge is multi-entity managed operations. Every phase serves it. The moment a build only helps HQOps become a broader horizontal platform, it's the wrong build.
