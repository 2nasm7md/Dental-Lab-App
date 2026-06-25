-- ============================================================================
-- Row Level Security
-- Every visibility rule in section 6 of the spec is enforced here.
-- The client may bypass UI checks; it cannot bypass these.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so policies don't recurse through RLS)
-- ---------------------------------------------------------------------------
create or replace function auth_user_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from users where id = auth.uid()
$$;

create or replace function auth_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from users where id = auth.uid()
$$;

create or replace function auth_user_org_type()
returns organization_type
language sql
stable
security definer
set search_path = public
as $$
  select o.type
  from users u
  join organizations o on o.id = u.organization_id
  where u.id = auth.uid()
$$;

create or replace function org_setting_bool(p_org_id uuid, p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((settings ->> p_key)::boolean, false) from organizations where id = p_org_id
$$;

-- True when the auth user can see a given case (used by cases + child tables)
create or replace function can_view_case(p_case_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c cases%rowtype;
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_role user_role;
  v_share_all boolean;
begin
  if v_user_id is null then
    return false;
  end if;
  select * into c from cases where id = p_case_id;
  if not found then
    return false;
  end if;

  select organization_id, role into v_org_id, v_role
  from users where id = v_user_id;

  -- Clinic side
  if v_org_id = c.clinic_org_id then
    if v_role = 'clinic_admin' then
      return true;
    end if;
    if v_role = 'doctor' then
      if c.owner_doctor_id = v_user_id then
        return true;
      end if;
      v_share_all := org_setting_bool(c.clinic_org_id, 'all_doctors_see_all_cases');
      return coalesce(v_share_all, false);
    end if;
    if v_role = 'secretary' then
      -- A secretary keeps access to cases they created
      if c.created_by = v_user_id then
        return true;
      end if;
      -- And to cases owned by doctors they assist (empty array = assists all)
      return exists (
        select 1 from users u
        where u.id = v_user_id
          and (
            cardinality(u.assists_doctor_ids) = 0
            or c.owner_doctor_id = any (u.assists_doctor_ids)
          )
      );
    end if;
  end if;

  -- Lab side: case must actually have been sent (no drafts ever leak)
  if v_org_id = c.lab_org_id and c.status <> 'draft' then
    if v_role = 'lab_admin' then
      return true;
    end if;
    if v_role = 'technician' then
      if c.assigned_technician_id = v_user_id then
        return true;
      end if;
      -- Optional: technicians can see unassigned incoming cases per org setting
      if c.assigned_technician_id is null
         and org_setting_bool(c.lab_org_id, 'techs_see_unassigned') then
        return true;
      end if;
      return false;
    end if;
  end if;

  return false;
end;
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
alter table organizations enable row level security;
alter table users enable row level security;
alter table connections enable row level security;
alter table invitations enable row level security;
alter table cases enable row level security;
alter table case_attachments enable row level security;
alter table case_status_history enable row level security;
alter table case_messages enable row level security;
alter table notifications enable row level security;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
-- Everyone authenticated can read orgs (needed for the lab directory).
create policy "orgs: read all (directory)"
  on organizations for select
  to authenticated
  using (deleted_at is null);

-- Only the org's own admin can update the org.
create policy "orgs: admin can update own"
  on organizations for update
  to authenticated
  using (
    id = auth_user_org_id()
    and auth_user_role() in ('clinic_admin', 'lab_admin')
  )
  with check (
    id = auth_user_org_id()
    and auth_user_role() in ('clinic_admin', 'lab_admin')
  );

-- Org creation goes through server actions (service role). No public insert.
create policy "orgs: no public insert"
  on organizations for insert
  to authenticated
  with check (false);

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
-- Everyone can see their own profile.
create policy "users: read self"
  on users for select
  to authenticated
  using (id = auth.uid());

-- Members of the same org can see each other.
create policy "users: read same org"
  on users for select
  to authenticated
  using (
    organization_id is not null
    and organization_id = auth_user_org_id()
  );

-- The owner can update their own profile (cannot change role/org).
create policy "users: update self"
  on users for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and organization_id is not distinct from (select organization_id from users where id = auth.uid())
    and role is not distinct from (select role from users where id = auth.uid())
  );

-- Org admins can update members of their org (e.g. change role).
create policy "users: admin manages org members"
  on users for update
  to authenticated
  using (
    organization_id = auth_user_org_id()
    and auth_user_role() in ('clinic_admin', 'lab_admin')
  )
  with check (
    organization_id = auth_user_org_id()
  );

-- Inserts happen via server action / trigger after signup.
create policy "users: self insert"
  on users for insert
  to authenticated
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- connections
-- ---------------------------------------------------------------------------
create policy "connections: read endpoints"
  on connections for select
  to authenticated
  using (
    clinic_org_id = auth_user_org_id() or lab_org_id = auth_user_org_id()
  );

-- A clinic admin can request a connection to a lab.
create policy "connections: clinic requests"
  on connections for insert
  to authenticated
  with check (
    clinic_org_id = auth_user_org_id()
    and auth_user_role() = 'clinic_admin'
  );

-- Either side admin can update (accept/block).
create policy "connections: admins update"
  on connections for update
  to authenticated
  using (
    (clinic_org_id = auth_user_org_id() and auth_user_role() = 'clinic_admin')
    or (lab_org_id = auth_user_org_id() and auth_user_role() = 'lab_admin')
  )
  with check (true);

create policy "connections: admins delete"
  on connections for delete
  to authenticated
  using (
    (clinic_org_id = auth_user_org_id() and auth_user_role() = 'clinic_admin')
    or (lab_org_id = auth_user_org_id() and auth_user_role() = 'lab_admin')
  );

-- ---------------------------------------------------------------------------
-- invitations
-- ---------------------------------------------------------------------------
create policy "invitations: org sees its own"
  on invitations for select
  to authenticated
  using (from_org_id = auth_user_org_id());

create policy "invitations: admin creates"
  on invitations for insert
  to authenticated
  with check (
    from_org_id = auth_user_org_id()
    and auth_user_role() in ('clinic_admin', 'lab_admin')
  );

create policy "invitations: admin revokes"
  on invitations for update
  to authenticated
  using (from_org_id = auth_user_org_id() and auth_user_role() in ('clinic_admin', 'lab_admin'))
  with check (from_org_id = auth_user_org_id());

-- ---------------------------------------------------------------------------
-- cases
-- ---------------------------------------------------------------------------
create policy "cases: read visible"
  on cases for select
  to authenticated
  using (deleted_at is null and can_view_case(id));

-- Clinic-side users create cases.
-- - doctor: must own the case they're creating
-- - secretary: must create on behalf of a doctor they can assist
-- - clinic_admin: can create on behalf of any doctor in the clinic
create policy "cases: clinic insert"
  on cases for insert
  to authenticated
  with check (
    clinic_org_id = auth_user_org_id()
    and created_by = auth.uid()
    and (
      (auth_user_role() = 'doctor' and owner_doctor_id = auth.uid())
      or (
        auth_user_role() = 'secretary'
        and exists (
          select 1 from users d
          where d.id = owner_doctor_id
            and d.organization_id = auth_user_org_id()
            and d.role = 'doctor'
            and (
              cardinality((select assists_doctor_ids from users where id = auth.uid())) = 0
              or d.id = any ((select assists_doctor_ids from users where id = auth.uid()))
            )
        )
      )
      or (
        auth_user_role() = 'clinic_admin'
        and exists (
          select 1 from users d
          where d.id = owner_doctor_id
            and d.organization_id = auth_user_org_id()
            and d.role = 'doctor'
        )
      )
    )
  );

-- Updates: anyone who can view the case may update fields scoped to their side.
-- Authorization for status transitions and side-specific fields is enforced
-- by the case-state-machine RPC, which uses security definer to bypass RLS
-- after running its own checks. This policy keeps day-to-day edits permissive
-- but safe at the row level.
create policy "cases: update visible"
  on cases for update
  to authenticated
  using (can_view_case(id))
  with check (can_view_case(id));

-- Soft delete only by clinic admin (the owner of the clinic record).
create policy "cases: clinic admin soft delete"
  on cases for delete
  to authenticated
  using (
    clinic_org_id = auth_user_org_id()
    and auth_user_role() = 'clinic_admin'
  );

-- ---------------------------------------------------------------------------
-- case_attachments
-- ---------------------------------------------------------------------------
create policy "attachments: read with case"
  on case_attachments for select
  to authenticated
  using (can_view_case(case_id));

create policy "attachments: write with case"
  on case_attachments for insert
  to authenticated
  with check (can_view_case(case_id) and uploaded_by = auth.uid());

create policy "attachments: delete own"
  on case_attachments for delete
  to authenticated
  using (uploaded_by = auth.uid() and can_view_case(case_id));

-- ---------------------------------------------------------------------------
-- case_status_history (read-only for clients; trigger writes)
-- ---------------------------------------------------------------------------
create policy "history: read with case"
  on case_status_history for select
  to authenticated
  using (can_view_case(case_id));

-- ---------------------------------------------------------------------------
-- case_messages
-- ---------------------------------------------------------------------------
create policy "messages: read with case"
  on case_messages for select
  to authenticated
  using (can_view_case(case_id));

create policy "messages: send with case"
  on case_messages for insert
  to authenticated
  with check (sender_id = auth.uid() and can_view_case(case_id));

create policy "messages: update own"
  on case_messages for update
  to authenticated
  using (sender_id = auth.uid() and can_view_case(case_id))
  with check (sender_id = auth.uid());

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create policy "notifications: recipient reads"
  on notifications for select
  to authenticated
  using (recipient_user_id = auth.uid());

create policy "notifications: recipient updates (mark read)"
  on notifications for update
  to authenticated
  using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());
