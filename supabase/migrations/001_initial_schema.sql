-- ============================================================================
-- Dental Clinic <-> Lab Platform — initial schema
-- Phase 1: Foundation tables, enums, indexes
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type organization_type as enum ('clinic', 'lab');

create type user_role as enum (
  'clinic_admin',
  'doctor',
  'secretary',
  'lab_admin',
  'technician'
);

create type connection_status as enum ('pending', 'active', 'blocked');

create type invitation_status as enum ('sent', 'accepted', 'expired', 'revoked');

create type case_status as enum (
  'draft',
  'pending',
  'declined',
  'accepted',
  'in_production',
  'ready',
  'delivered',
  'redo',
  'cancelled'
);

create type restoration_type as enum (
  'crown',
  'bridge',
  'veneer',
  'inlay_onlay',
  'denture_full',
  'denture_partial',
  'implant_crown',
  'implant_bridge',
  'night_guard',
  'other'
);

create type material_type as enum (
  'zirconia',
  'emax',
  'pfm',
  'full_metal',
  'pmma',
  'acrylic',
  'other'
);

create type payment_status as enum ('unpaid', 'partially_paid', 'paid');

create type attachment_type as enum ('image', 'file');

create type notification_type as enum (
  'case_assigned',
  'case_accepted',
  'case_declined',
  'status_changed',
  'new_message',
  'connection_request',
  'connection_accepted',
  'payment_updated'
);

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
create table organizations (
  id uuid primary key default gen_random_uuid(),
  type organization_type not null,
  name text not null,
  phone text,
  email text,
  address text,
  logo_url text,
  currency text not null default 'USD',
  settings jsonb not null default jsonb_build_object(
    'all_doctors_see_all_cases', false,
    'cost_tracking_enabled', true,
    'pending_timeout_hours', 48,
    'techs_see_unassigned', true
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index organizations_type_idx on organizations(type) where deleted_at is null;
create index organizations_name_idx on organizations(lower(name)) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- users (profile rows; id mirrors auth.users.id)
-- ---------------------------------------------------------------------------
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete set null,
  role user_role,
  full_name text not null default '',
  phone text,
  avatar_url text,
  is_active boolean not null default true,
  -- For a secretary scoped to specific doctors. Empty array = all doctors.
  assists_doctor_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index users_org_idx on users(organization_id);
create index users_role_idx on users(role);

-- ---------------------------------------------------------------------------
-- connections — clinic <-> lab handshake
-- ---------------------------------------------------------------------------
create table connections (
  id uuid primary key default gen_random_uuid(),
  clinic_org_id uuid not null references organizations(id) on delete cascade,
  lab_org_id uuid not null references organizations(id) on delete cascade,
  status connection_status not null default 'pending',
  requested_by uuid references users(id) on delete set null,
  responded_by uuid references users(id) on delete set null,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint connections_unique_pair unique (clinic_org_id, lab_org_id)
);

create index connections_clinic_idx on connections(clinic_org_id);
create index connections_lab_idx on connections(lab_org_id);
create index connections_status_idx on connections(status);

-- ---------------------------------------------------------------------------
-- invitations — invite an off-platform partner
-- ---------------------------------------------------------------------------
create table invitations (
  id uuid primary key default gen_random_uuid(),
  from_org_id uuid not null references organizations(id) on delete cascade,
  invited_email text,
  invited_phone text,
  invited_org_type organization_type not null,
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  status invitation_status not null default 'sent',
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_org_id uuid references organizations(id) on delete set null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index invitations_token_idx on invitations(token);
create index invitations_from_org_idx on invitations(from_org_id);

-- ---------------------------------------------------------------------------
-- cases — the core entity
-- ---------------------------------------------------------------------------
create table cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null,
  clinic_org_id uuid not null references organizations(id) on delete cascade,
  lab_org_id uuid references organizations(id) on delete set null,
  owner_doctor_id uuid not null references users(id) on delete restrict,
  created_by uuid not null references users(id) on delete restrict,
  assigned_technician_id uuid references users(id) on delete set null,
  status case_status not null default 'draft',

  -- Clinical
  patient_name text,
  patient_ref text,
  tooth_numbers text[] not null default '{}',
  restoration_type restoration_type,
  material material_type,
  shade text,
  due_date date,
  doctor_notes text,

  -- Money (visible only when org cost tracking is enabled)
  price numeric(12,2),
  currency text,
  payment_status payment_status,

  -- Lab decline reason (when status = declined)
  decline_reason text,

  -- Future-proof bucket so we never need a migration for minor attrs
  metadata jsonb not null default '{}'::jsonb,

  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint cases_case_number_unique unique (clinic_org_id, case_number)
);

create index cases_clinic_idx on cases(clinic_org_id) where deleted_at is null;
create index cases_lab_idx on cases(lab_org_id) where deleted_at is null;
create index cases_owner_doctor_idx on cases(owner_doctor_id) where deleted_at is null;
create index cases_technician_idx on cases(assigned_technician_id) where deleted_at is null;
create index cases_status_idx on cases(status) where deleted_at is null;
create index cases_due_date_idx on cases(due_date) where deleted_at is null;
create index cases_created_at_idx on cases(created_at desc) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- case_attachments
-- ---------------------------------------------------------------------------
create table case_attachments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  uploaded_by uuid not null references users(id) on delete restrict,
  file_url text not null,
  file_type attachment_type not null default 'image',
  thumbnail_url text,
  caption text,
  size_bytes integer,
  created_at timestamptz not null default now()
);

create index case_attachments_case_idx on case_attachments(case_id);

-- ---------------------------------------------------------------------------
-- case_status_history — audit trail
-- ---------------------------------------------------------------------------
create table case_status_history (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  from_status case_status,
  to_status case_status not null,
  changed_by uuid references users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index case_status_history_case_idx on case_status_history(case_id, created_at desc);

-- ---------------------------------------------------------------------------
-- case_messages — per-case chat
-- ---------------------------------------------------------------------------
create table case_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  sender_id uuid not null references users(id) on delete restrict,
  body text not null default '',
  attachment_url text,
  attachment_type attachment_type,
  read_by jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index case_messages_case_idx on case_messages(case_id, created_at desc);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references users(id) on delete cascade,
  type notification_type not null,
  case_id uuid references cases(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx on notifications(recipient_user_id, created_at desc);
create index notifications_unread_idx on notifications(recipient_user_id) where is_read = false;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger organizations_set_updated_at
  before update on organizations
  for each row execute function set_updated_at();

create trigger users_set_updated_at
  before update on users
  for each row execute function set_updated_at();

create trigger connections_set_updated_at
  before update on connections
  for each row execute function set_updated_at();

create trigger cases_set_updated_at
  before update on cases
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Case number generator (per clinic): YY-NNNN counter
-- ---------------------------------------------------------------------------
create or replace function next_case_number(p_clinic_org_id uuid)
returns text
language plpgsql
as $$
declare
  v_year text := to_char(now(), 'YY');
  v_seq int;
begin
  select coalesce(
    max(
      case
        when case_number ~ ('^' || v_year || '-[0-9]+$')
        then (split_part(case_number, '-', 2))::int
        else 0
      end
    ),
    0
  ) + 1
  into v_seq
  from cases
  where clinic_org_id = p_clinic_org_id;

  return v_year || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

-- Auto-assign case_number on insert if empty
create or replace function fill_case_number()
returns trigger
language plpgsql
as $$
begin
  if new.case_number is null or new.case_number = '' then
    new.case_number := next_case_number(new.clinic_org_id);
  end if;
  return new;
end;
$$;

create trigger cases_fill_case_number
  before insert on cases
  for each row execute function fill_case_number();

-- ---------------------------------------------------------------------------
-- Helper: write status history on every status change
-- ---------------------------------------------------------------------------
create or replace function record_case_status_change()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT') then
    insert into case_status_history (case_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, new.created_by);
  elsif (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    insert into case_status_history (case_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger cases_record_status_change
  after insert or update of status on cases
  for each row execute function record_case_status_change();
