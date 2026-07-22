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

Never commit secrets or keys to the repo.

## Key Files

- `src/App.jsx` — entire CRM application (~2500 lines). All views,
  components, state, CRUD handlers, persistence layer, and routing live
  here. This is the source of truth for app behavior.
- `src/main.jsx` — entry point. Auth gate, demo mode detection
  (`/demo` path), portal routing (`/portal/*`), renders `<App>` or
  `<Portal>`.
- `src/Auth.jsx` — CRM owner login and signup UI.
- `src/Portal.jsx` — client portal pages: `/portal/login` and
  `/portal/dashboard`. Reads from `portal_snapshots` and
  `portal_messages`.
- `src/lib/supabase.js` — Supabase client initialization, `window.storage`
  adapter (wraps crm_store reads/writes), portal auth helpers
  (`portalSignIn`, `portalUpdatePassword`, `adminCreatePortal`, etc.).
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

Demo entities (visible only at /demo, never saved to Supabase):
- e1 — Apex Ventures LLC
- e2 — GreenPath Foundation

## Working Conventions

- Commits: Action-oriented, descriptive commit messages. Co-authoring with Claude is fine.
- Push: Do not push to GitHub without explicit confirmation from Matt. Commit locally, show the result, wait for confirmation.
- Deploy cadence: Batch all changes in a session into a single deploy at the end. Do not deploy after every small fix.
- SQL changes: Do not attempt to run DDL via MCP. Provide the SQL block and instruct Matt to run it in the Supabase SQL Editor, then verify the tables exist via REST before proceeding.
- Secrets: Never log, commit, or expose SUPABASE_SERVICE_ROLE_KEY or any other secret. It lives only in Netlify env vars and .env.local (not committed).
- macOS access: If file system access errors occur, check System Settings → Privacy & Security → Files and Folders.

## Current State (as of May 2026)

Working:
- Full CRM at hqops.app with email/password auth
- Multi-user team access (July 2026): accounts + roles (owner/admin/member),
  account switcher in the sidebar, Settings → Team tab with copy-link
  invites, /invite/:token accept flow. Role checks enforced in RLS/definer
  functions and in the portal admin Netlify Functions, not just the UI.
- Contacts, Companies, Deals with proper bidirectional relationships
- Pipeline with 8 stages (New Lead → Contacted → Responded / Interested → Follow-up / Discovery → Demo Scheduled → Proposal Sent → Won → Lost)
- HubSpot CSV import (Contacts, Companies, Deals) with auto-detection and column mapping
- AI-powered import (PDF, image, text via Claude API)
- Reports with custom report builder, PDF/CSV export, 7 templates
- Client portal with Supabase Auth — clients get their own login, tabs are built but portal snapshot population not yet wired
- Demo mode at /demo (session-only, zero Supabase writes)
- Fairway Circuit: HubSpot data imported
- Crestfolio: entities set up, data entry in progress

Known gaps / next up:
- Client portal tabs need real data wired into snapshots
- Stripe payment integration (Pay Now is placeholder)
- Gmail/Outlook two-way email sync not yet connected
- CRM Inbox does not yet surface portal messages
- Client file upload to CRM Docs not yet wired

Roadmap (not yet built):
- Target Account Plans with Word document export
- Relationship Maps (interactive stakeholder visualization)
- Zapier/webhook outbound (config UI built, firing logic partial)
- Calendly / Cal.com booking integration
- QuickBooks / accounting sync
- DocuSign eSignature (currently using built-in canvas signing)
- Twilio SMS sequences
- 'field' role for account_members (reserved in the check constraint, not implemented)
- Invite emails (invites are copy-link only until transactional email exists)

## Reference Context

This project was built entirely in a Claude.ai conversation starting May 2026. The conversation history contains all architectural decisions, feature specs, audit results, and bug fix records. Key decisions made during build:

- Single-file Vite + React architecture (no component split files) for simplicity during solo development
- localStorage replaced by Supabase crm_store on deployment
- Demo mode uses in-memory state, never touches Supabase
- Portal clients are real Supabase Auth users created via service role key in a Netlify Function (not client-side signUp)
- Stage migration runs once per session to remap legacy HubSpot stage names to HQOps pipeline stages
