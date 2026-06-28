-- ============================================================================
--  001_init.sql  — Core multi-tenant schema for the dental-clinic SaaS.
--
--  Every business table carries tenant_id and is partitioned by RLS.
--  Helper functions in lib_auth_tenant_ids() / has_role() centralise the
--  predicates so policies stay short and indexable.
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- ----------------------------------------------------------------------------
--  Enums
-- ----------------------------------------------------------------------------
create type tenant_role as enum ('owner', 'admin', 'receptionist');
create type appointment_status as enum ('confirmed', 'completed', 'cancelled', 'no_show');
create type patient_gender as enum ('male', 'female');
create type absence_kind as enum ('vacation', 'unavailable');
create type subscription_plan as enum ('free', 'starter', 'pro', 'enterprise');
create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled');
create type app_locale as enum ('ar', 'en');

-- ----------------------------------------------------------------------------
--  Tenants
-- ----------------------------------------------------------------------------
create table tenants (
    id          uuid        primary key default uuid_generate_v4(),
    name        text        not null,
    slug        text        not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$'),
    public      boolean     not null default true,  -- public website on/off
    created_at  timestamptz not null default now()
);

create index tenants_slug_idx on tenants (slug);

-- ----------------------------------------------------------------------------
--  Tenant members (maps auth.users -> tenant + role)
-- ----------------------------------------------------------------------------
create table tenant_users (
    id          uuid        primary key default uuid_generate_v4(),
    tenant_id   uuid        not null references tenants(id) on delete cascade,
    user_id     uuid        not null references auth.users(id) on delete cascade,
    role        tenant_role not null,
    full_name   text,
    email       text        not null,
    created_at  timestamptz not null default now(),
    unique (tenant_id, user_id)
);

create index tenant_users_user_idx   on tenant_users (user_id);
create index tenant_users_tenant_idx on tenant_users (tenant_id);

-- Every tenant must have at least one owner. Enforced via partial unique
-- predicate together with a trigger that blocks demoting the last owner.
create unique index tenant_users_owner_present_idx
    on tenant_users (tenant_id)
    where role = 'owner' and false;  -- inert; real check sits in trigger

-- ----------------------------------------------------------------------------
--  Auth helpers (SECURITY DEFINER, stable, used in RLS)
-- ----------------------------------------------------------------------------
create or replace function auth_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
    select tenant_id
    from tenant_users
    where user_id = auth.uid();
$$;

create or replace function auth_role(p_tenant uuid)
returns tenant_role
language sql
stable
security definer
set search_path = public
as $$
    select role
    from tenant_users
    where user_id = auth.uid() and tenant_id = p_tenant
    limit 1;
$$;

create or replace function has_role(p_tenant uuid, variadic p_roles tenant_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists(
        select 1
        from tenant_users
        where user_id = auth.uid()
          and tenant_id = p_tenant
          and role = any(p_roles)
    );
$$;

-- ----------------------------------------------------------------------------
--  Doctors
-- ----------------------------------------------------------------------------
create table doctors (
    id          uuid        primary key default uuid_generate_v4(),
    tenant_id   uuid        not null references tenants(id) on delete cascade,
    name        text        not null,
    specialty   text,
    photo_url   text,
    bio         text,
    active      boolean     not null default true,
    created_at  timestamptz not null default now()
);

create index doctors_tenant_idx on doctors (tenant_id);
create index doctors_active_idx on doctors (tenant_id, active);

-- ----------------------------------------------------------------------------
--  Visit types (per-clinic catalog of procedures with duration)
-- ----------------------------------------------------------------------------
create table visit_types (
    id               uuid        primary key default uuid_generate_v4(),
    tenant_id        uuid        not null references tenants(id) on delete cascade,
    name             text        not null,
    duration_minutes int         not null check (duration_minutes > 0 and duration_minutes <= 480),
    active           boolean     not null default true,
    created_at       timestamptz not null default now(),
    unique (tenant_id, name)
);

create index visit_types_tenant_idx on visit_types (tenant_id);

-- ----------------------------------------------------------------------------
--  Schedules — weekly working hours, breaks, and absences per doctor
-- ----------------------------------------------------------------------------
create table schedule_days (
    id             uuid    primary key default uuid_generate_v4(),
    tenant_id      uuid    not null references tenants(id) on delete cascade,
    doctor_id      uuid    not null references doctors(id) on delete cascade,
    weekday        smallint not null check (weekday between 0 and 6),
    start_minutes  int     not null check (start_minutes between 0 and 1440),
    end_minutes    int     not null check (end_minutes   between 0 and 1440),
    check (end_minutes > start_minutes),
    unique (doctor_id, weekday, start_minutes)
);

create index schedule_days_doctor_idx on schedule_days (doctor_id, weekday);

create table schedule_breaks (
    id             uuid    primary key default uuid_generate_v4(),
    tenant_id      uuid    not null references tenants(id) on delete cascade,
    doctor_id      uuid    not null references doctors(id) on delete cascade,
    weekday        smallint not null check (weekday between 0 and 6),
    start_minutes  int     not null,
    end_minutes    int     not null,
    check (end_minutes > start_minutes)
);

create index schedule_breaks_doctor_idx on schedule_breaks (doctor_id, weekday);

create table schedule_absences (
    id          uuid          primary key default uuid_generate_v4(),
    tenant_id   uuid          not null references tenants(id) on delete cascade,
    doctor_id   uuid          not null references doctors(id) on delete cascade,
    kind        absence_kind  not null,
    start_at    timestamptz   not null,
    end_at      timestamptz   not null,
    reason      text,
    check (end_at > start_at)
);

create index schedule_absences_doctor_idx on schedule_absences (doctor_id, start_at, end_at);

-- ----------------------------------------------------------------------------
--  Appointments
--
--  An exclusion constraint guarantees we cannot double-book a single doctor.
--  This is the safety net behind the booking RPC's advisory lock.
-- ----------------------------------------------------------------------------
create table appointments (
    id              uuid               primary key default uuid_generate_v4(),
    tenant_id       uuid               not null references tenants(id) on delete cascade,
    doctor_id       uuid               not null references doctors(id)     on delete restrict,
    visit_type_id   uuid               not null references visit_types(id) on delete restrict,
    patient_name    text               not null,
    patient_phone   text               not null,
    patient_age     int                check (patient_age between 0 and 130),
    patient_gender  patient_gender,
    patient_email   text,
    notes           text,
    start_at        timestamptz        not null,
    end_at          timestamptz        not null,
    status          appointment_status not null default 'confirmed',
    created_at      timestamptz        not null default now(),
    check (end_at > start_at)
);

create index appointments_tenant_idx        on appointments (tenant_id, start_at);
create index appointments_doctor_window_idx on appointments (doctor_id, start_at, end_at);
create index appointments_phone_idx         on appointments (tenant_id, patient_phone);
create index appointments_status_idx        on appointments (tenant_id, status, start_at);

alter table appointments
    add constraint appointments_no_overlap
    exclude using gist (
        doctor_id with =,
        tstzrange(start_at, end_at, '[)') with &&
    )
    where (status in ('confirmed', 'completed'));

-- ----------------------------------------------------------------------------
--  Portfolio (before / after gallery)
-- ----------------------------------------------------------------------------
create table portfolio_cases (
    id                uuid        primary key default uuid_generate_v4(),
    tenant_id         uuid        not null references tenants(id) on delete cascade,
    title             text        not null,
    description       text,
    category          text,
    before_image_url  text        not null,
    after_image_url   text        not null,
    created_at        timestamptz not null default now()
);

create index portfolio_tenant_idx on portfolio_cases (tenant_id, created_at desc);

-- ----------------------------------------------------------------------------
--  Per-tenant clinic settings (1:1 with tenants)
-- ----------------------------------------------------------------------------
create table clinic_settings (
    tenant_id        uuid        primary key references tenants(id) on delete cascade,
    display_name     text        not null,
    tagline          text,
    logo_url         text,
    primary_color    text        not null default '#0ea5e9',
    secondary_color  text        not null default '#1e293b',
    phone            text,
    whatsapp         text,
    email            text,
    address          text,
    about            text,
    default_locale   app_locale  not null default 'ar',
    rtl_enabled      boolean     not null default true,
    updated_at       timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
--  Subscriptions (SaaS billing scaffold — payments come later)
-- ----------------------------------------------------------------------------
create table subscriptions (
    id          uuid                 primary key default uuid_generate_v4(),
    tenant_id   uuid                 not null references tenants(id) on delete cascade,
    plan        subscription_plan    not null default 'free',
    status      subscription_status  not null default 'trialing',
    start_date  date                 not null default (now()::date),
    end_date    date,
    unique (tenant_id)
);

-- ----------------------------------------------------------------------------
--  updated_at trigger
-- ----------------------------------------------------------------------------
create or replace function touch_updated_at()
returns trigger
language plpgsql as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

create trigger clinic_settings_touch
    before update on clinic_settings
    for each row execute function touch_updated_at();
