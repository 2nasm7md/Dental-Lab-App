# DentOS — Multi-tenant SaaS for Dental Clinics

Production-ready Next.js 15 SaaS that lets dental clinics manage doctors,
visit types, schedules, appointments and a public-facing portfolio — and
take online bookings through a per-clinic public website.

## Highlights

- **True multi-tenancy.** Every business row carries `tenant_id` and is
  isolated by PostgreSQL Row Level Security. A `SECURITY DEFINER` helper
  (`auth_tenant_ids()`) backs concise, indexable policies.
- **Roles + RBAC.** `owner`, `admin`, `receptionist` enforced both at the
  database (RLS) and the server-action layer (`hasPermission` matrix).
- **Real availability engine.** Pure-TS slot computation (working hours
  ∖ breaks ∖ absences ∖ existing appointments) with a configurable step.
  Public booking re-validates server-side under an advisory lock; the
  `appointments_no_overlap` exclusion constraint is the last line of
  defence against double-booking under concurrency.
- **Per-tenant public website** at `/c/<slug>` with hero, doctors,
  services, before/after portfolio, contact and footer. Arabic-first,
  RTL by default, with EN/LTR toggle. Theme color drawn from per-clinic
  branding.
- **Phone-based appointment lookup.** Public RPC returns a curated
  projection — only the fields a patient would need.
- **SaaS scaffold.** `subscriptions` table is in place, ready for
  Stripe / payments later without a schema rewrite.

## Stack

- Next.js 15 App Router · React 18 · TypeScript
- Supabase (Postgres, Auth, Storage) with full RLS
- Tailwind CSS · shadcn/ui-style primitives · lucide-react
- React Hook Form · Zod · TanStack Table / Query
- next-intl (ar / en, RTL ↔ LTR) · next-themes (dark mode)

## Repository tour

```
src/
  app/
    (auth)/                  login, signup
    onboarding/              provision tenant (slug + name)
    (dashboard)/             authenticated app shell
      dashboard/             KPIs + today's queue
      doctors/               CRUD
      visit-types/           CRUD (per-clinic catalog)
      schedules/             weekly hours, breaks, absences
      appointments/          list + calendar, filters, status changes
      portfolio/             before/after gallery
      settings/              branding, contact, locale, public toggle
    c/[slug]/                public per-clinic website
      page.tsx               marketing home (hero, doctors, services, portfolio, contact)
      book/                  multi-step booking wizard
      lookup/                phone-based search
    page.tsx                 marketing / signup CTA
  components/
    ui/                      Button, Input, Dialog, Select, Tabs, …
    layout/                  sidebar, topbar, page header
    providers/               QueryClient, ThemeProvider
  lib/
    auth/                    session, permissions matrix
    availability/            pure-TS slot engine + server fetchers
    i18n/                    next-intl config
    supabase/                browser / server / anon / middleware clients
    types/db.ts              row shapes
    validation/              Zod schemas (auth, doctors, visit-types, …)
  server/actions/            server actions (mutating side of every feature)
  messages/                  ar.json (default) · en.json

supabase/migrations/
  001_init.sql               tables, enums, indexes, EXCLUDE constraints
  002_rls.sql                row-level security policies
  003_storage.sql            buckets + per-tenant write policy
  004_functions.sql          provision_tenant, book_appointment, lookup
```

## Local setup

```bash
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_APP_URL

npm install
# Apply migrations in order via Supabase SQL editor or:
#   supabase db push
npm run dev
```

## Architectural notes

### Tenant isolation

`tenant_users` maps `auth.users` → `tenant_id` + role. RLS predicates are
expressed as `tenant_id in (select auth_tenant_ids())` for member reads
and `has_role(tenant_id, 'owner', …)` for management. All helpers are
`SECURITY DEFINER` + `STABLE` so they cache per statement.

### Public surface

`tenants.public = true` is the gate for the anonymous read path. The
public website uses an anon Supabase client; RLS restricts what it sees
to `tenants`, `doctors`, `visit_types`, `schedule_days`,
`portfolio_cases`, `clinic_settings`. Anonymous reads of
`schedule_breaks`/`schedule_absences` are intentionally denied — the
booking RPC re-validates against them.

### Availability + booking

The wizard renders candidate slots client-side from the data anon can
see (working hours minus existing appointments). On submit, the
`book_appointment` SECURITY DEFINER RPC:

1. Resolves the tenant from slug.
2. Asserts doctor + visit type belong to that tenant and are active.
3. Acquires a doctor-scoped `pg_advisory_xact_lock`.
4. Re-checks for any overlapping confirmed/completed appointment **and**
   any matching absence.
5. Inserts the row. The `appointments_no_overlap` exclusion constraint
   is the database-level safety net.

### Roles → permissions

| Action               | owner | admin | receptionist |
|----------------------|-------|-------|--------------|
| Manage doctors       | ✓     | ✓     |              |
| Manage visit types   | ✓     | ✓     |              |
| Manage schedules     | ✓     | ✓     |              |
| Manage appointments  | ✓     | ✓     | ✓            |
| Manage portfolio     | ✓     | ✓     |              |
| Manage settings      | ✓     |       |              |
| View site / data     | ✓     | ✓     | ✓            |

## Phases delivered

- **Phase 1** — Foundation: deps, tsconfig, tailwind theme, i18n, utils, types.
- **Phase 2** — Schema, RLS, storage, RPCs (`provision_tenant`, `book_appointment`, lookup).
- **Phase 3** — Supabase auth, signup → onboarding → tenant provisioning, RBAC.
- **Phase 4** — Dashboard UI for doctors, visit types, schedules, appointments, portfolio, settings.
- **Phase 5** — Availability engine (pure TS) + booking wizard.
- **Phase 6** — Public clinic website + phone lookup.
- **Phase 7** — Loading states, 404, dark mode, typecheck-clean build.

## Deploy

1. Create a Supabase project, apply the four migrations in order.
2. Deploy on Vercel; set env vars from `.env.example`.
3. Add your deploy URL to Supabase Auth → URL Configuration so
   confirmation / reset emails land back on the right host.
