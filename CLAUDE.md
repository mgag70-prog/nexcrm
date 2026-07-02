# NexCRM — Claude Code Context

Standing context for Claude Code and any AI assistant working in this repo.
Read this first.

## Project Overview

NexCRM is a multi-entity CRM platform built for professionals who run more
than one business or client practice and need a single tool to manage all
of them without data mixing between entities. It combines contact and
pipeline management with invoicing, time tracking, document storage,
e-signatures, email sequences, web-to-lead forms, workflow automation,
AI-powered data import, and a branded authenticated client portal.

It also ships a **Field Service** vertical: entities of type "Field Service
Business" get relabeled terminology (Jobs / Job Board instead of Deals /
Pipeline), employee management, a QuickBooks-style time clock, job
scheduling with recurring jobs, job costing, and an expense log.

- **App URL:** https://nexcrm.app
- **Demo URL:** https://nexcrm.app/demo (no login required, session-only data)
- **Client portal login:** https://nexcrm.app/portal/login
- **Netlify site name:** nexcrm-io
- **Founder:** Matt Gray (mgag70@gmail.com)
- **Stage:** Personal use (Fairway Circuit LLC and Crestfolio LLC), with
  plans for public launch. The client portal is live with real data — clients
  get their own authenticated login and can view/pay invoices, sign
  documents, and message the owner.

## Repository

- **Repo:** github.com/mgag70-prog/nexcrm
- **Working directory (Matt's machine):** /Users/mattgray/Desktop/nexcrm
- **Default branch:** main
- **Deploy:** Netlify auto-deploys on push to main

## Tech Stack

- **Bundler:** Vite 5
- **Framework:** React 18 (JSX, not TypeScript)
- **Language:** JavaScript
- **Charts:** Recharts (Reports view)
- **Hosting:** Netlify (with Netlify Functions for server-side portal ops)
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
  - CRM owners: email/password at nexcrm.app
  - Portal clients: separate email/password at nexcrm.app/portal/login,
    created via Netlify Function using service role key
- **AI:** Anthropic Claude API (AI-powered contact/company import from
  PDFs, images, and unstructured text)
- **Payments:** Stripe — planned, not yet wired (Pay Now is a placeholder)
- **Email:** No transactional email service configured yet. In-app email
  integration connects owner's Gmail or Outlook to log sent/received
  emails on contact timelines.

Runtime dependencies (see `package.json`): `@supabase/supabase-js`, `react`,
`react-dom`, `recharts`. No CSS framework — all styling is inline style
objects in the JSX.

## Supabase Project (IMPORTANT)

**The NexCRM project ID is `knnacndatngcgfzdcdgv`.**
URL: https://knnacndatngcgfzdcdgv.supabase.co

When querying Supabase via MCP tools, always pass
`project_id: "knnacndatngcgfzdcdgv"` explicitly. The MCP server may have
access to other unrelated Supabase projects on this account and will
default to the wrong one.

### Tables

- `crm_store` — primary data store. Columns: `key` (text), `value`
  (text, JSON-serialized), `user_id` (uuid). Composite PK on
  (user_id, key). RLS restricts rows to the authenticated owner's
  `auth.uid()`.
- `portal_snapshots` — snapshot of data exposed to a client portal.
  Columns: `token`, `payload` (jsonb), `scope`, `scope_id`, `entity_id`,
  `settings`, `created_at`. Public read, authenticated write.
- `portal_clients` — links a Supabase auth user to a portal token.
  Columns: `id`, `user_id`, `token`, `entity_id`, `scope`,
  `scope_id`, `first_login`, `created_at`, `last_accessed`.
  RLS: users see only their own row.
- `portal_messages` — bidirectional messages between client and CRM owner.
  Columns: `id`, `token`, `sender_type` (client|owner), `sender_name`,
  `content`, `created_at`, `read`. Authenticated read/write. Also carries
  **structured client→CRM actions** (e.g. sign_doc, pay_invoice): the
  client encodes an action into the message body via `makeActionMessage`,
  and the App.jsx message listener parses it to update `crm:docs` /
  invoices and log a note on the contact timeline.

Schema changes (DDL) must be applied manually in the Supabase SQL Editor.
The repo does not auto-apply migrations.

## Environment Variables

### Netlify (production)

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role secret (used only
  by Netlify Functions; never exposed to the browser)

Never commit secrets or keys to the repo. Local dev uses `.env` /
`.env.local` (gitignored).

## Key Files

- `src/App.jsx` — the **entire CRM application** (~7,500 lines / ~565 KB).
  All views, components, state, CRUD handlers, persistence layer, Field
  Service features, portal snapshot builder, and routing live here. This
  is the source of truth for app behavior. Code is intentionally dense
  (minimal whitespace, compressed style objects) — match that style when
  editing.
- `src/main.jsx` — entry point. Auth gate, demo mode detection
  (`/demo` path), portal routing (`/portal/*`), renders `<App>` or
  `<Portal>`.
- `src/Auth.jsx` — CRM owner login and signup UI.
- `src/Portal.jsx` — client portal pages (~1,000 lines): `/portal/login`
  and `/portal/dashboard`, with Overview / Invoices / Documents / Messages
  tabs. Reads from `portal_snapshots` and `portal_messages`; sends
  structured actions back via `portalSendMessage`.
- `src/lib/supabase.js` — Supabase client init, `storage` adapter (wraps
  crm_store get/set/delete/list, exposed as `window.storage`), portal
  snapshot read/write (`fetchPortalSnapshot`, `writePortalSnapshot`),
  portal auth helpers (`portalSignIn`, `portalUpdatePassword`,
  `adminCreatePortal`, `adminRevokePortal`, …), and realtime
  subscription helpers (`subscribePortalSnapshot`,
  `subscribePortalMessagesForTokens`).
- `netlify/functions/portal-create.js` — creates a Supabase Auth user for
  a new portal client via admin API, inserts `portal_clients` and
  `portal_snapshots` rows.
- `netlify/functions/portal-regenerate.js` — regenerates client temp
  password.
- `netlify/functions/portal-revoke.js` — deletes auth user and all
  associated portal rows.
- `netlify/functions/_shared.js` — admin Supabase client factory, owner
  bearer token validator, shared error helpers.
- `netlify.toml` — build config (`npm run build` / `dist`), functions dir,
  esbuild bundler, and SPA redirect rule (`/* → /index.html 200`).
- `vite.config.js` — Vite + React plugin config.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — production build to `dist/`
- `npm run preview` — preview the production build

There are no tests, linters, or typecheck steps configured.

## Data Architecture

All CRM data is stored as JSON blobs in `crm_store`, keyed by data type.
Current keys (see the `keys` array in the initial-load effect in App.jsx):

crm:entities, crm:contacts, crm:companies, crm:deals, crm:tasks,
crm:notes, crm:emailInts, crm:products, crm:sequences, crm:templates,
crm:forms, crm:automations, crm:docs, crm:quotes, crm:customFields,
crm:enrollments, crm:timeEntries, crm:invoices, crm:meetings,
crm:webhooks, crm:portalTokens, crm:emailThreads, crm:availability,
crm:invoiceCounter, crm:signatures, crm:customReports, **crm:employees,
crm:timeClockEntries, crm:fsSettings, crm:expenses**, crm:activeEntityId

The last four (employees, timeClockEntries, fsSettings, expenses) back the
Field Service vertical.

**Persistence flow:**
- On login, all keys are loaded via a sequential `storage.get` loop.
- A `loadedRef` gate (and `hydrated` state) prevents save effects from
  firing before the initial load completes — this prevents a mount-time
  race that would wipe user data with empty initial state.
- Each state slice has a `useEffect` that calls `save(key, value)` on
  change; `save` is a no-op in demo mode and before the load gate opens.
  A `saveStatus` object tracks saving/saved/error for the UI.

**Offline support (Field Service time clock):**
- `crm:tcQueue` is a **localStorage** queue (not crm_store) that buffers
  clock-in / clock-out actions taken while offline so they survive a page
  reload. `online`/`offline` window events flush the queue and force a
  fresh write of `crm:timeClockEntries` when connectivity returns. An
  offline banner shows at the top of the app.

**One-time stage migration:**
- After the initial load, a `useEffect` remaps any deal whose stage isn't
  in its entity's pipeline, using `STAGE_MIGRATION_MAP` (legacy HubSpot /
  Zoho stage names → current NexCRM stages), falling back to the entity's
  first stage. Runs once per session (`stageMigrationRanRef`).

## Entities & Field Service

Entity types (`ETYPES`): LLC, Corporation, Non-Profit, Partnership, Sole
Proprietor, S-Corp, Trust, **Field Service Business**.

**Real entities (personal use):**
- e3 — Fairway Circuit LLC (navy #0F2044, Sports & Recreation,
  fairwaycircuit.com)
- e4 — Crestfolio LLC (green #059669, Financial Services, crestfolio.io,
  custom pipeline stages, custom contact fields: Contact Type, AUM Range,
  Relationship Manager, Referral Source)

**Demo entities (visible only at /demo, never saved to Supabase):**
- e1 — Apex Ventures LLC (Technology)
- e2 — GreenPath Foundation (Non-Profit, Education)
- e5 — GreenScape Pro (Field Service Business, Landscaping) — demonstrates
  the Field Service vertical

**Field Service terminology:** `isFieldService(entity)` gates behavior.
The `t(entity, key)` helper swaps labels via `FS_TERMS` (deal→Job,
Pipeline→Job Board, Close Date→Scheduled Date, Proposal Sent→Estimate
Sent, Contacts→Customers, etc.).

**Pipelines:**
- Sales `STAGES`: New Lead → Contacted → Responded / Interested →
  Follow-up / Discovery → Demo Scheduled → Proposal Sent → Won → Lost
- Field Service `FS_STAGES`: New Lead → Contacted → Estimate Sent →
  Won / Scheduled → In Progress → Completed → Lost
- Entities may override with their own `stages` / `stageColors`.
  `stagesFor(entity)` and `stagesForWithOrphans(entity, deals)` resolve
  the active pipeline (the latter appends any orphan stages found on deals
  so legacy/imported data still renders).

## Navigation / Views

The left sidebar `NAV` array drives the main views: Dashboard, Contacts,
Companies, Pipeline (**Job Board** for FS), Tasks, Inbox, Scheduler,
**Time Clock** (FS only), Time Tracking, Invoices, Client Portal, Import,
Sequences, Web Forms, Automation, Reports, Settings. The app is a
single-page state machine keyed on a `view` string — there is no router
for the authenticated CRM (only path-based routing in `main.jsx` for
`/`, `/demo`, and `/portal/*`).

The layout is **mobile-responsive** (768px breakpoint via `useIsMobile`):
sidebar collapses to a hamburger overlay, a mobile topbar with expandable
search, a fixed bottom nav, a Kanban stage selector, card lists instead of
tables, and full-screen modals with 44px tap targets.

## Client Portal (live)

The portal is wired with real data end-to-end:
- **Snapshot builder:** `buildSnapshotPayload(token)` in App.jsx assembles
  the client-visible payload (contact, invoices, docs, quotes, deals,
  tasks, expenses scoped to the token). `writePortalSnapshot` pushes it to
  `portal_snapshots`; snapshots auto-refresh when underlying CRM data
  (e.g. deal/invoice/doc) changes to prevent drift.
- **Realtime + polling:** the CRM subscribes to `portal_messages` for its
  tokens (`subscribePortalMessagesForTokens`) with a 15s polling fallback
  in case the realtime publication isn't enabled. The portal likewise
  subscribes to its snapshot and messages.
- **Structured actions:** client actions (sign document, request pay,
  etc.) are sent as `portal_messages` encoded via `makeActionMessage`; the
  App.jsx listener parses them, updates CRM state, and logs a note.
- **CRM Inbox** surfaces portal messages alongside email.

## Working Conventions

- **Commits:** Action-oriented, descriptive commit messages. Co-authoring
  with Claude is fine.
- **Push:** Do not push to GitHub without explicit confirmation from Matt.
  Commit locally, show the result, wait for confirmation. (This applies to
  Matt's local workflow; automated branch sessions follow their own branch
  instructions.)
- **Deploy cadence:** Batch all changes in a session into a single deploy
  at the end. Do not deploy after every small fix.
- **SQL changes:** Do not run DDL via MCP. Provide the SQL block and
  instruct Matt to run it in the Supabase SQL Editor, then verify the
  tables exist via REST before proceeding.
- **Secrets:** Never log, commit, or expose SUPABASE_SERVICE_ROLE_KEY or
  any other secret. It lives only in Netlify env vars and `.env.local`
  (not committed).
- **Code style:** App.jsx is a single dense file by design. Keep new work
  in the same file and match the compact formatting rather than splitting
  into modules or reformatting existing code.
- **macOS access:** If file system access errors occur, check System
  Settings → Privacy & Security → Files and Folders.

## Current State (as of July 2026)

Working:
- Full CRM at nexcrm.app with email/password auth
- Contacts, Companies, Deals with proper bidirectional relationships
- Sales pipeline (8 stages) and Field Service Job Board (7 stages)
- HubSpot / Zoho CSV import with auto-detection and column mapping
- AI-powered import (PDF, image, text via Claude API)
- Reports with custom report builder, PDF/CSV export, templates (Recharts)
- **Client portal live with real data** — snapshots auto-populate, realtime
  messaging, invoice viewing, canvas e-signature, structured client→CRM
  actions; CRM Inbox surfaces portal messages
- **Field Service vertical** — employee management, QuickBooks-style time
  clock (approvals, OT detection, verification photo, My Hours, correction
  requests, offline mode), job scheduling with recurring jobs, job costing
- **Expense Log** — per-deal tracking, job-costing breakdown, pass-through
  invoicing, reports & portal exposure
- **Mobile-responsive layout** across the whole app
- Demo mode at /demo (session-only, zero Supabase writes), including a
  Field Service demo entity
- Fairway Circuit: HubSpot data imported; Crestfolio: data entry in
  progress

Known gaps / next up:
- Stripe payment integration (Pay Now is placeholder)
- Gmail/Outlook two-way email sync not yet connected
- Client file upload to CRM Docs not yet wired

Roadmap (not yet built):
- Target Account Plans with Word document export
- Relationship Maps (interactive stakeholder visualization)
- Zapier/webhook outbound (config UI built; `fireWebhook` currently only
  records lastFired/lastStatus — real HTTP firing is a stub)
- Calendly / Cal.com booking integration
- QuickBooks / accounting sync
- DocuSign eSignature (currently using built-in canvas signing)
- Twilio SMS sequences
- Multi-user / team access

## Reference Context

This project was built entirely in Claude conversations starting May 2026.
Key architectural decisions:

- Single-file Vite + React architecture (no component split files) for
  simplicity during solo development
- localStorage replaced by Supabase `crm_store` on deployment; the Field
  Service offline time-clock queue still uses localStorage by design
- Demo mode uses in-memory state, never touches Supabase
- Portal clients are real Supabase Auth users created via service role key
  in a Netlify Function (not client-side signUp)
- Portal client actions flow back as structured `portal_messages`, not a
  separate write path, to keep a single audit trail
- Stage migration runs once per session to remap legacy imported stage
  names to the current pipeline
