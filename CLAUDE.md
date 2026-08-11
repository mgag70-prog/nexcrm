# HQOps — Claude Code Context

Standing context for Claude Code and any AI assistant working in this repo.
Read this first.

## Project Overview

HQOps (formerly NexCRM) is a multi-entity CRM platform built for professionals who run more
than one business or client practice and need a single tool to manage all
of them without data mixing between entities. It combines contact and
pipeline management with invoicing, time tracking, document storage,
e-signatures, email sequences, web-to-lead forms, workflow automation,
AI-powered data import, and a branded authenticated client portal.

- **App URL:** https://hqops.app (nexcrm.app redirects here)
- **Demo URL:** https://hqops.app/demo (no login required, session-only data)
- **Client portal login:** https://hqops.app/portal/login
- **Netlify site name:** hqops
- **Founder:** Matt Gray (mgag70@gmail.com)
- **Stage:** Personal use (Fairway Circuit LLC and Crestfolio LLC), with
  plans for public launch. The client portal is already designed for
  external client use — clients get their own authenticated login.

## Repository

- **Repo:** github.com/mgag70-prog/nexcrm
- **Working directory:** /Users/mattgray/dev/nexcrm
- **Default branch:** main
- **Deploy:** Netlify auto-deploys on push to main

## Tech Stack

- **Bundler:** Vite
- **Framework:** React 18 (JSX, not TypeScript)
- **Language:** JavaScript
- **Hosting:** Netlify (with Netlify Functions for server-side portal ops)
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
  - CRM owners: email/password at hqops.app
  - Portal clients: separate email/password at hqops.app/portal/login,
    created via Netlify Function using service role key
- **AI:** Anthropic Claude API (AI-powered contact/company import from
  PDFs, images, and unstructured text)
- **Payments:** Stripe — planned, not yet wired (Pay Now is a placeholder)
- **Email:** No transactional email service configured yet. In-app email
  integration connects owner's Gmail or Outlook to log sent/received
  emails on contact timelines.

## Supabase Project (IMPORTANT)

**The HQOps project ID is `knnacndatngcgfzdcdgv`.**
URL: https://knnacndatngcgfzdcdgv.supabase.co

When querying Supabase via MCP tools, always pass
`project_id: "knnacndatngcgfzdcdgv"` explicitly. The MCP server may have
access to other unrelated Supabase projects on this account and will
default to the wrong one.

### Tables

Data belongs to an ACCOUNT (the team + billing unit); users are members of
one or more accounts with a role in each (multi-user team access, July 2026).

- `accounts` — the team/billing unit. Columns: `id`, `name`, `created_by`,
  `plan`, `created_at`. Matt's account is "GrayHQ Consulting"
  (`0c7fd6a5-3e40-48b2-9920-4c5d0135e07b`).
- `account_members` — membership + role. Columns: `id`, `account_id`,
  `user_id`, `role` ('owner'|'admin'|'member'; 'field' reserved),
  `created_at`. Unique on (account_id, user_id). Exactly one owner per
  account. Writes go ONLY through SECURITY DEFINER functions
  (`set_member_role`, `remove_member`, `transfer_ownership`,
  `create_account`, `accept_invite`) — there are no direct write policies.
- `account_invites` — pending team invites. Columns: `id`, `account_id`,
  `email`, `role`, `token` (unique, the invite URL secret), `invited_by`,
  `accepted`, `created_at`, `expires_at` (14 days). Owner/admin only via RLS.
  Accept flow uses `get_invite(token)` / `accept_invite(token)` RPCs.
- `crm_store` — primary data store. Columns: `key`, `value` (text,
  JSON-serialized), `account_id` (uuid), `user_id` (uuid, legacy safety net,
  records last writer). Composite PK on (account_id, key). RLS gates all
  four verbs on `is_account_member(account_id)` (SECURITY DEFINER helper;
  `get_my_role(account_id)` is the role-checking sibling).
- `portal_snapshots` — snapshot of data exposed to a client portal.
  Columns: `token`, `payload` (jsonb), `scope`, `scope_id`, `entity_id`,
  `settings`, `account_id`, `created_at`. Public read, authenticated write.
- `portal_clients` — links a Supabase auth user to a portal token.
  Columns: `id`, `user_id`, `token`, `entity_id`, `scope`, `scope_id`,
  `first_login`, `account_id`, `created_at`, `last_accessed`.
  RLS: users see only their own row. The portal admin Netlify Functions
  verify the caller is owner/admin of the row's `account_id`.
- `portal_messages` — bidirectional messages between client and CRM owner.
  Columns: `id`, `token`, `sender_type` (client|owner), `sender_name`,
  `content`, `created_at`, `read`. Authenticated read/write.

Schema changes (DDL) must be applied manually in the Supabase SQL Editor.
The repo does not auto-apply migrations.

## Environment Variables

### Netlify (production)

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role secret (used only
  by Netlify Functions; never exposed to the browser)
- `ANTHROPIC_API_KEY` — Anthropic API key. Server-side only, **not**
  `VITE_`-prefixed, so it never reaches the browser bundle. Read by
  `netlify/functions/ai-claude.js`; powers both AI import and Prep me.

Never commit secrets or keys to the repo.

## Key Files

- `src/App.jsx` — entire CRM application (~9300 lines). All views,
  components, state, CRUD handlers, persistence layer, and routing live
  here. This is the source of truth for app behavior. (Splitting this file
  is a committed Phase 3 task — see the roadmap; it is past the size a
  single context window holds comfortably.)
- `src/main.jsx` — entry point. Auth gate, demo mode detection
  (`/demo` path), portal routing (`/portal/*`), renders `<App>` or
  `<Portal>`.
- `src/Auth.jsx` — CRM owner login and signup UI.
- `src/Portal.jsx` — client portal pages: `/portal/login` and
  `/portal/dashboard`. Reads from `portal_snapshots` and
  `portal_messages`.
- `src/lib/supabase.js` — Supabase client initialization, `window.storage`
  adapter (wraps crm_store reads/writes), portal auth helpers
  (`portalSignIn`, `portalUpdatePassword`, `adminCreatePortal`, etc.), and
  `callClaude()` — the single client entry point for AI (used by both AI
  import and Prep me), which posts to the `ai-claude` function with a fresh
  owner bearer token.
- `netlify/functions/ai-claude.js` — server-side Anthropic proxy. Holds
  `ANTHROPIC_API_KEY`, gates on an authenticated CRM owner
  (`authenticateOwner` in `_shared.js`), and forwards to the Anthropic
  Messages API. The browser never calls `api.anthropic.com` directly and
  never sees the key.
- `netlify/functions/portal-create.js` — creates a Supabase Auth user for
  a new portal client via admin API, inserts `portal_clients` and
  `portal_snapshots` rows.
- `netlify/functions/portal-regenerate.js` — regenerates client temp
  password.
- `netlify/functions/portal-revoke.js` — deletes auth user and all
  associated portal rows.
- `netlify/functions/_shared.js` — admin Supabase client factory, owner
  bearer token validator, shared error helpers.
- `netlify.toml` — build config (`npm run build` / `dist`) and SPA
  redirect rule (`/* → /index.html 200`).
- `docs/HQOps_Calendar_Mockup.html` — APPROVED design spec for the
  Calendar view (week-first time grid, entity load bars, prose brief,
  right-side CRM context panel). Match this, do not redesign it.
- `docs/HQOps_Roadmap.md` — **the committed development roadmap: the source
  of truth for what we build next and in what order.** Read it before
  proposing or planning new features. See the Development Roadmap section
  below for the frame.
- `vite.config.js` — Vite + React plugin config.

## Data Architecture

All CRM data is stored as JSON blobs in `crm_store`, keyed by data type:

crm:entities, crm:contacts, crm:companies, crm:deals, crm:tasks,
crm:notes, crm:emailInts, crm:products, crm:sequences, crm:templates,
crm:forms, crm:automations, crm:docs, crm:quotes, crm:customFields,
crm:enrollments, crm:timeEntries, crm:invoices, crm:meetings,
crm:webhooks, crm:portalTokens, crm:emailThreads, crm:availability,
crm:invoiceCounter, crm:signatures, crm:customReports, crm:activeEntityId

On login, all keys are loaded via a sequential storage.get loop. A loadedRef gate prevents save effects from firing before the initial load completes (prevents mount-time race that would wipe user data).

## Entities

Two real entities (personal use):
- e3 — Fairway Circuit LLC (color: #0F2044 navy, industry: Sports & Recreation, website: fairwaycircuit.com)
- e4 — Crestfolio LLC (color: #059669 green, industry: Financial Services, website: crestfolio.io, custom pipeline stages, custom contact fields: Contact Type, AUM Range, Relationship Manager, Referral Source)

Demo entities (visible only at /demo, never saved to Supabase). Renamed
(commit e332763) to mirror the four industries on the marketing site:
- Calder Advisory (advisory / professional services)
- Ridgeline Property Co (property management)
- Marchfield Landscaping (field service)
- Two Rivers Studio (creative studio)

Demo data lives entirely in `DEMO_FULL` and is enriched so every feature
has data that exercises it: `DEMO_CALENDAR_EVENTS` and
`DEMO_EMAIL_MESSAGES` (both were empty before because calendar/email read
from Supabase, which demo never touches), all dates relative to now, and
deal-health scores spread across every band.

## Working Conventions

- Commits: Action-oriented, descriptive commit messages. Co-authoring with Claude is fine.
- Push: Do not push to GitHub without explicit confirmation from Matt. Commit locally, show the result, wait for confirmation.
- Deploy cadence: Batch all changes in a session into a single deploy at the end. Do not deploy after every small fix.
- SQL changes: Do not attempt to run DDL via MCP. Provide the SQL block and instruct Matt to run it in the Supabase SQL Editor, then verify the tables exist via REST before proceeding.
- Secrets: Never log, commit, or expose SUPABASE_SERVICE_ROLE_KEY or any other secret. It lives only in Netlify env vars and .env.local (not committed).
- macOS access: If file system access errors occur, check System Settings → Privacy & Security → Files and Folders.

## Verification Boundaries

There are things you structurally cannot verify. Attempting elaborate
workarounds for them has repeatedly consumed hours and hundreds of dollars
across sessions. Specifically, you cannot:

- Read Matt's real CRM data — it's behind RLS and you have no service-role key
- Drive his authenticated browser session
- See rendered UI in his browser
- Complete OAuth consent flows on his behalf

When verification hits one of these boundaries: **STOP.** Do not build test
harnesses, spin up throwaway accounts, run timed log-watching scripts, or
construct elaborate SQL extractions to work around it.

Instead:

1. Verify everything that IS mechanically testable — unit tests, builds, API
   responses, headless checks against public surfaces.
2. Report exactly what you verified and how.
3. Hand Matt a short numbered checklist of what only he can confirm, with the
   specific thing to look at and what "correct" looks like.

A three-line checklist he can run in sixty seconds beats an hour of scripted
approximation. Most of what he needs to confirm is visually obvious on screen.

Throwaway test accounts have twice required manual cleanup. Avoid creating
them unless there is no alternative; if you must, report the cleanup SQL in
the same message.

## Current State (as of July 2026)

Working:
- Full CRM at hqops.app with email/password auth
- Multi-user team access (July 2026): accounts + roles (owner/admin/member),
  account switcher in the sidebar, Settings → Team tab with copy-link
  invites, /invite/:token accept flow. Role checks enforced in RLS/definer
  functions and in the portal admin Netlify Functions, not just the UI.
- Contacts, Companies, Deals with proper bidirectional relationships
- Pipeline with 8 stages (New Lead → Contacted → Responded / Interested → Follow-up / Discovery → Demo Scheduled → Proposal Sent → Won → Lost)
- HubSpot CSV import (Contacts, Companies, Deals) with auto-detection and column mapping
- AI-powered import (PDF, image, text) — routes through the `ai-claude`
  server proxy; verified working live. (Before the proxy the client did a
  keyless fetch to `api.anthropic.com`, so AI import had never actually
  worked in production.)
- Prep me — one-click AI pre-meeting contact briefing on the calendar
  panel, ContactDetail, and DealDetail. Shares `callClaude()` with AI
  import. Empty-state rule: below a data threshold it shows raw facts
  instead of a padded summary. Nothing is persisted. Verified working live.
- Quotes read surfaces — Quotes tabs on Deal/Contact detail and a
  Quotes|Invoices toggle (quotes were create-only before). Signed docs
  display the signature + attribution. Job costing shows in-progress
  clocked-in crew separately from confirmed labor. Entity-wide expenses view.
- Reports with custom report builder, PDF/CSV export, 7 templates
- Client portal with Supabase Auth — clients get their own login, tabs are built but portal snapshot population not yet wired
- Demo mode at /demo (session-only, zero Supabase writes)
- Fairway Circuit: HubSpot data imported
- Crestfolio: entities set up, data entry in progress

Known gaps / open items:
- **Lint does not block the build yet.** ESLint flat config
  (`eslint.config.js`) and `npm run lint` now exist (Aug 2026) and do catch
  the undefined-reference class that put three AI bugs into production —
  `no-undef` and `react/jsx-no-undef` are errors, verified against a canary.
  The codebase is at 0 lint errors. The REMAINING piece is wiring lint into
  the build as a blocking step, which waits on triaging the ~175 deferred
  warnings (mostly unused vars and exhaustive-deps in App.jsx; the App.jsx
  split should clear most of them). Roadmap Phase 3.1.
- **`deal_won` automation/webhook trigger is still keyed to the literal
  `"Won"`** — it silently won't fire on field-service ("Won / Scheduled")
  or custom pipeline stages. Fix before building any won-triggered
  automation for a client. (Roadmap Phase 2.3.)
- Desktop nav: verify other views don't leave stale selection state (the
  Contacts nav case was fixed in 570774d; the pattern may exist elsewhere).
- Client portal tabs need real data wired into snapshots.
- Stripe payments are unbuilt (Pay Now is a placeholder) — this is the
  centerpiece of the roadmap; see Phase 2 (Connect) and Phase 4 (Checkout).
- Gmail/Outlook two-way email sync not yet connected.
- CRM Inbox does not yet surface portal messages.
- Client file upload to CRM Docs not yet wired.
- Batch 3 cosmetic audit items (C2, C3) deferred.
- 'field' role reserved in the account_members check constraint, not
  implemented — built when the first field-service client is real
  (Roadmap Phase 2.4).

## Development Roadmap

`docs/HQOps_Roadmap.md` is the committed roadmap and the source of truth
for what gets built next and in what order. It is "committed decisions,
not options." Read it before proposing or planning new features. The frame:

The wedge is **multi-entity managed operations** — one operator, many
businesses, isolated data, one bill — which competitors architecturally
can't match. Every phase must serve that wedge or close a table-stakes gap;
anything that only makes HQOps a broader horizontal platform is out.

- **Phase 2 — Client payments + platform readiness.** Stripe **Connect**:
  a GrayHQ managed client's customers pay *the client* through HQOps, money
  to the client's own bank. **Not blocked by GrayHQ's LLC** — buildable
  now. Plus platform hardening (payroll export, break tracking, PTO, portal
  job photos), the `deal_won` fix, and the `field` role when the first
  crew-based client is real.
- **Phase 3 — GrayHQ scale + hardening.** Engineering hygiene (ESLint
  shipped Aug 2026; lint-as-build-gate + smoke checks + splitting App.jsx
  remain), a projects layer above tasks, and
  **cross-entity roll-up reporting** across managed client accounts.
- **Phase 4 — Self-serve.** Stripe **Checkout** (strangers pay GrayHQ for
  HQOps), trial-end read-only enforcement, Google **CASA** verification,
  and marketing-site depth. Only after the platform is proven on managed
  clients.
- **Parked (external unblock):** GrayHQ collecting its own consulting fees
  — a Stripe account + payment links against GrayHQ's own bank. Blocked by
  the pending IL LLC / business bank account, not a dev phase. A third,
  separate use of Stripe — do not conflate it with Phase 2 Connect or
  Phase 4 Checkout.
- **Explicit non-goals (deliberately not building):** voice/calling,
  inventory, and full accounting (HQOps prepares clean data for the
  client's bookkeeper — a selling point, not a gap). Also: feature-parity
  with competitors for its own sake.

## Reference Context

This project was built entirely in a Claude.ai conversation starting May 2026. The conversation history contains all architectural decisions, feature specs, audit results, and bug fix records. Key decisions made during build:

- Single-file Vite + React architecture (no component split files) for simplicity during solo development
- localStorage replaced by Supabase crm_store on deployment
- Demo mode uses in-memory state, never touches Supabase
- Portal clients are real Supabase Auth users created via service role key in a Netlify Function (not client-side signUp)
- Stage migration runs once per session to remap legacy HubSpot stage names to HQOps pipeline stages
