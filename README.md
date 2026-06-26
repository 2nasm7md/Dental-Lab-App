# Dental Clinic ⇄ Lab Platform

A two-sided SaaS platform that connects dental clinics with dental labs and organizes the prosthetic cases a clinic sends to a lab.

This repository implements **Phases 1–3 (web)** of the build plan: data model, RLS, auth, onboarding, connections, case creation, dashboards, the case lifecycle state machine, per-case realtime chat, the timeline, **realtime in-app notifications**, and the **shared cost-tracking ledger** with per-partner totals. The UI is Arabic-first with full RTL. The Expo doctor mobile app (Phase 3) is deferred.

## Stack

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **Supabase** — PostgreSQL, Auth, Realtime, Storage
- **Row-Level Security** enforces every visibility rule at the database
- **next-intl** for Arabic/English (RTL/LTR)
- **TanStack Query**, **Zod**, **lucide-react**

## Project layout

```
src/
  app/                 Next routes
    (auth)/            login, signup
    onboarding/        org provisioning
    (app)/             dashboard, cases, connections, notifications, settings
  components/          UI primitives + feature components
  lib/
    case-state-machine.ts    Single source of truth for the lifecycle
    dental.ts                FDI tooth numbers, shade guides, restoration meta
    i18n/                    next-intl setup
    queries/                 Read-side helpers
    supabase/                Browser + server + middleware clients
    types/db.ts              Hand-typed DB shapes
  messages/            ar.json (default), en.json
  server/actions/      All mutating server actions

supabase/migrations/
  001_initial_schema.sql      Tables, enums, indexes, triggers
  002_rls_policies.sql        Row-level security for every table
  003_state_machine.sql       Transition RPCs: send/accept/decline/advance/...
  004_storage_buckets.sql     case-attachments / avatars / org-logos
  005_notifications.sql       new_message/connection_request/payment_updated
                              triggers + realtime publication + mark-all-read
  006_clinic_admin_as_owner.sql  Allow clinic_admin to own cases themselves
                              (solo-clinic case-insert RLS fix)
```

## Setup

1. Create a Supabase project and copy keys into `.env.local`:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

2. Apply migrations (in order) via the Supabase SQL editor or CLI:

   ```bash
   supabase db push
   # or paste 001, 002, 003, 004 SQL files in order
   ```

3. Install and run:

   ```bash
   npm install
   npm run dev
   ```

## Deploy to Vercel

The repo is Vercel-ready. The remote execution environment this code was
written in cannot reach `vercel.com`, so deploy is a manual click-through —
takes about two minutes.

### 1. Import the repo

Go to <https://vercel.com/new>, pick **Import Git Repository**, and select
`2nasm7md/Dental-Lab-App`. Vercel auto-detects Next.js — leave the build
settings alone.

If you want the first deploy to come off this branch instead of `main`,
on the import screen switch the **Production Branch** to
`claude/youthful-meitner-s7pfgt` (or merge to `main` first).

### 2. Set environment variables

In the import wizard's **Environment Variables** section, add these
(values come from your Supabase project's Settings → API):

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xisnldlfuiyryzzzchgl.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the `anon`/`publishable` key |
| `SUPABASE_SERVICE_ROLE_KEY` | the `service_role` key (mark **Sensitive**) |
| `NEXT_PUBLIC_APP_URL` | `https://<your-vercel-domain>.vercel.app` |
| `DEFAULT_LOCALE` | `ar` |

> The service role key bypasses RLS — set it as Sensitive and never expose
> it client-side. The app only reads it from `createSupabaseServiceClient`
> in `src/lib/supabase/server.ts`, which is server-only code.

### 3. Add the Vercel domain to Supabase Auth

In Supabase → Authentication → URL Configuration, add the deployed URL
(and any preview-URL pattern you want) to **Site URL** and **Redirect URLs**.
Without this, magic-link / password-reset emails will redirect to localhost.

### 4. Click Deploy

The first build takes ~2 min. Once live, sign up → onboarding will land
you on the dashboard. If you haven't run the four SQL migrations yet,
signup will fail with an RLS / missing-table error — apply them first.

### Preview deployments

Every push to a non-production branch gets its own preview URL. Pull
requests from `claude/*` branches will deploy automatically, so future
feature work is reviewable before merging.

## Phase plan

- **Phase 1 ✅** — Auth, orgs, connections, case CRUD, state machine, dashboards, chat, RLS.
- **Phase 2 ✅** — Realtime in-app notification fan-out (bell + page) for every trigger
  (`case_assigned`, `case_accepted`, `case_declined`, `status_changed`, `new_message`,
  `connection_request`, `connection_accepted`, `payment_updated`).
- **Phase 3 ✅ (web)** — Shared cost ledger: per-case price + payment status editor,
  `/billing` page with per-partner totals and overall billed/paid/balance. Expo
  mobile app is deferred.
- **Phase 4** — Board views, overdue/timeout flagging, advanced filters.

## Permission model — quick reference

Every row in `cases`, `case_attachments`, `case_status_history`, and `case_messages` is gated by the `can_view_case(case_id)` SQL helper, which mirrors the spec exactly:

- `clinic_admin` → sees all clinic cases.
- `doctor` → sees own cases (or all cases when `all_doctors_see_all_cases` is true).
- `secretary` → sees cases they created plus cases owned by doctors in `assists_doctor_ids` (empty = assists all).
- `lab_admin` → sees all incoming cases (never drafts).
- `technician` → sees their assigned cases; unassigned incoming if `techs_see_unassigned` is true.

## State machine

`src/lib/case-state-machine.ts` and `supabase/migrations/003_state_machine.sql` agree on:

```
draft → pending → (accepted | declined)
accepted → in_production → ready → delivered → (redo → in_production)
declined → pending (reassigned)
{draft,pending,declined} → cancelled
```

Every transition runs through an RPC (`send_case`, `accept_case`, `decline_case`, `advance_case`, `reassign_case`, `assign_technician`, `cancel_case`) which writes to `case_status_history` and enqueues notifications.
