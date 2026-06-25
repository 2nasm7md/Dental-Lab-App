-- ============================================================================
-- Case state machine — server-enforced transitions
-- Every transition rule and side-permission lives here. Clients call these
-- RPCs; they cannot mutate `status` directly without going through them.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper: enqueue a notification (no-op if recipient is null)
-- ---------------------------------------------------------------------------
create or replace function enqueue_notification(
  p_recipient uuid,
  p_type notification_type,
  p_case_id uuid,
  p_payload jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_recipient is null then
    return;
  end if;
  insert into notifications (recipient_user_id, type, case_id, payload)
  values (p_recipient, p_type, p_case_id, coalesce(p_payload, '{}'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- send_case — clinic dispatches a draft to the configured lab
-- ---------------------------------------------------------------------------
create or replace function send_case(p_case_id uuid)
returns cases
language plpgsql
security definer
set search_path = public
as $$
declare
  c cases%rowtype;
  v_uid uuid := auth.uid();
  v_role user_role := auth_user_role();
  v_org uuid := auth_user_org_id();
  v_lab_admin uuid;
begin
  select * into c from cases where id = p_case_id for update;
  if not found then raise exception 'Case not found'; end if;
  if c.clinic_org_id <> v_org then raise exception 'Not your case'; end if;
  if c.status <> 'draft' then raise exception 'Only drafts can be sent (was %)', c.status; end if;
  if c.lab_org_id is null then raise exception 'Pick a lab before sending'; end if;
  if v_role not in ('clinic_admin', 'doctor', 'secretary') then
    raise exception 'Not allowed';
  end if;
  if not exists (
    select 1 from connections
    where clinic_org_id = c.clinic_org_id and lab_org_id = c.lab_org_id and status = 'active'
  ) then
    raise exception 'No active connection with this lab';
  end if;

  update cases
    set status = 'pending', sent_at = coalesce(sent_at, now())
    where id = p_case_id
    returning * into c;

  -- Notify the lab admin(s)
  for v_lab_admin in
    select id from users where organization_id = c.lab_org_id and role = 'lab_admin' and is_active
  loop
    perform enqueue_notification(
      v_lab_admin, 'case_assigned', c.id,
      jsonb_build_object('case_number', c.case_number)
    );
  end loop;

  return c;
end;
$$;

-- ---------------------------------------------------------------------------
-- accept_case — lab admin accepts a pending case
-- ---------------------------------------------------------------------------
create or replace function accept_case(p_case_id uuid, p_assigned_technician uuid default null)
returns cases
language plpgsql
security definer
set search_path = public
as $$
declare
  c cases%rowtype;
  v_uid uuid := auth.uid();
  v_role user_role := auth_user_role();
  v_org uuid := auth_user_org_id();
begin
  select * into c from cases where id = p_case_id for update;
  if not found then raise exception 'Case not found'; end if;
  if c.lab_org_id <> v_org then raise exception 'Not your lab'; end if;
  if v_role <> 'lab_admin' then raise exception 'Only lab admin can accept'; end if;
  if c.status <> 'pending' then raise exception 'Only pending cases can be accepted (was %)', c.status; end if;

  if p_assigned_technician is not null then
    if not exists (
      select 1 from users
      where id = p_assigned_technician and organization_id = v_org and role = 'technician' and is_active
    ) then
      raise exception 'Technician not in this lab';
    end if;
  end if;

  update cases
    set status = 'accepted',
        assigned_technician_id = coalesce(p_assigned_technician, c.assigned_technician_id),
        decline_reason = null
    where id = p_case_id
    returning * into c;

  -- Notify clinic owner doctor + creator
  perform enqueue_notification(c.owner_doctor_id, 'case_accepted', c.id,
    jsonb_build_object('case_number', c.case_number));
  if c.created_by <> c.owner_doctor_id then
    perform enqueue_notification(c.created_by, 'case_accepted', c.id,
      jsonb_build_object('case_number', c.case_number));
  end if;
  if p_assigned_technician is not null then
    perform enqueue_notification(p_assigned_technician, 'case_assigned', c.id,
      jsonb_build_object('case_number', c.case_number));
  end if;
  return c;
end;
$$;

-- ---------------------------------------------------------------------------
-- decline_case — lab admin declines with a reason
-- ---------------------------------------------------------------------------
create or replace function decline_case(p_case_id uuid, p_reason text)
returns cases
language plpgsql
security definer
set search_path = public
as $$
declare
  c cases%rowtype;
  v_role user_role := auth_user_role();
  v_org uuid := auth_user_org_id();
begin
  select * into c from cases where id = p_case_id for update;
  if not found then raise exception 'Case not found'; end if;
  if c.lab_org_id <> v_org then raise exception 'Not your lab'; end if;
  if v_role <> 'lab_admin' then raise exception 'Only lab admin can decline'; end if;
  if c.status <> 'pending' then raise exception 'Only pending cases can be declined (was %)', c.status; end if;

  update cases
    set status = 'declined', decline_reason = p_reason
    where id = p_case_id
    returning * into c;

  perform enqueue_notification(c.owner_doctor_id, 'case_declined', c.id,
    jsonb_build_object('case_number', c.case_number, 'reason', p_reason));
  if c.created_by <> c.owner_doctor_id then
    perform enqueue_notification(c.created_by, 'case_declined', c.id,
      jsonb_build_object('case_number', c.case_number, 'reason', p_reason));
  end if;
  return c;
end;
$$;

-- ---------------------------------------------------------------------------
-- reassign_case — clinic picks a different lab after a decline
-- ---------------------------------------------------------------------------
create or replace function reassign_case(p_case_id uuid, p_new_lab_id uuid)
returns cases
language plpgsql
security definer
set search_path = public
as $$
declare
  c cases%rowtype;
  v_org uuid := auth_user_org_id();
  v_role user_role := auth_user_role();
  v_lab_admin uuid;
begin
  select * into c from cases where id = p_case_id for update;
  if not found then raise exception 'Case not found'; end if;
  if c.clinic_org_id <> v_org then raise exception 'Not your case'; end if;
  if v_role not in ('clinic_admin', 'doctor', 'secretary') then raise exception 'Not allowed'; end if;
  if c.status <> 'declined' then raise exception 'Only declined cases can be reassigned (was %)', c.status; end if;
  if not exists (
    select 1 from connections
    where clinic_org_id = c.clinic_org_id and lab_org_id = p_new_lab_id and status = 'active'
  ) then
    raise exception 'No active connection with the new lab';
  end if;

  update cases
    set lab_org_id = p_new_lab_id,
        status = 'pending',
        assigned_technician_id = null,
        decline_reason = null,
        sent_at = now()
    where id = p_case_id
    returning * into c;

  for v_lab_admin in
    select id from users where organization_id = p_new_lab_id and role = 'lab_admin' and is_active
  loop
    perform enqueue_notification(v_lab_admin, 'case_assigned', c.id,
      jsonb_build_object('case_number', c.case_number));
  end loop;
  return c;
end;
$$;

-- ---------------------------------------------------------------------------
-- assign_technician — lab admin only
-- ---------------------------------------------------------------------------
create or replace function assign_technician(p_case_id uuid, p_technician uuid)
returns cases
language plpgsql
security definer
set search_path = public
as $$
declare
  c cases%rowtype;
  v_role user_role := auth_user_role();
  v_org uuid := auth_user_org_id();
begin
  select * into c from cases where id = p_case_id for update;
  if not found then raise exception 'Case not found'; end if;
  if c.lab_org_id <> v_org then raise exception 'Not your lab'; end if;
  if v_role <> 'lab_admin' then raise exception 'Only lab admin can assign'; end if;
  if c.status in ('draft', 'pending', 'declined', 'cancelled', 'delivered') then
    raise exception 'Cannot assign a technician in status %', c.status;
  end if;
  if not exists (
    select 1 from users
    where id = p_technician and organization_id = v_org and role = 'technician' and is_active
  ) then
    raise exception 'Technician not in this lab';
  end if;

  update cases set assigned_technician_id = p_technician
    where id = p_case_id returning * into c;
  perform enqueue_notification(p_technician, 'case_assigned', c.id,
    jsonb_build_object('case_number', c.case_number));
  return c;
end;
$$;

-- ---------------------------------------------------------------------------
-- advance_case — generic lab-side forward transition
-- Allowed: accepted→in_production, in_production→ready, ready→delivered,
--          delivered→redo (clinic), redo→in_production (lab)
-- ---------------------------------------------------------------------------
create or replace function advance_case(p_case_id uuid, p_to case_status, p_note text default null)
returns cases
language plpgsql
security definer
set search_path = public
as $$
declare
  c cases%rowtype;
  v_role user_role := auth_user_role();
  v_org uuid := auth_user_org_id();
  v_uid uuid := auth.uid();
  v_is_lab boolean;
  v_is_clinic boolean;
  v_allowed boolean := false;
begin
  select * into c from cases where id = p_case_id for update;
  if not found then raise exception 'Case not found'; end if;

  v_is_lab := (c.lab_org_id = v_org);
  v_is_clinic := (c.clinic_org_id = v_org);

  -- Lab-side production progress
  if v_is_lab and v_role in ('lab_admin', 'technician') then
    if v_role = 'technician' and c.assigned_technician_id is distinct from v_uid then
      raise exception 'Technicians can only advance their own assigned cases';
    end if;
    if (c.status, p_to) in (
      ('accepted', 'in_production'),
      ('in_production', 'ready'),
      ('ready', 'delivered'),
      ('redo', 'in_production')
    ) then
      v_allowed := true;
    end if;
  end if;

  -- Clinic-side rework request
  if v_is_clinic and v_role in ('clinic_admin', 'doctor', 'secretary') then
    if (c.status, p_to) = ('delivered', 'redo') then
      v_allowed := true;
    end if;
  end if;

  if not v_allowed then
    raise exception 'Transition % → % not allowed for your role', c.status, p_to;
  end if;

  update cases
    set status = p_to,
        delivered_at = case when p_to = 'delivered' then now() else delivered_at end
    where id = p_case_id
    returning * into c;

  -- The trigger writes the history row; we add the note if provided
  if p_note is not null and p_note <> '' then
    update case_status_history
      set note = p_note
      where id = (
        select id from case_status_history where case_id = c.id order by created_at desc limit 1
      );
  end if;

  -- Notify the other side
  if v_is_lab then
    perform enqueue_notification(c.owner_doctor_id, 'status_changed', c.id,
      jsonb_build_object('case_number', c.case_number, 'to', p_to));
    if c.created_by <> c.owner_doctor_id then
      perform enqueue_notification(c.created_by, 'status_changed', c.id,
        jsonb_build_object('case_number', c.case_number, 'to', p_to));
    end if;
  elsif v_is_clinic then
    if c.assigned_technician_id is not null then
      perform enqueue_notification(c.assigned_technician_id, 'status_changed', c.id,
        jsonb_build_object('case_number', c.case_number, 'to', p_to));
    end if;
  end if;
  return c;
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel_case — clinic only, before acceptance
-- ---------------------------------------------------------------------------
create or replace function cancel_case(p_case_id uuid, p_reason text default null)
returns cases
language plpgsql
security definer
set search_path = public
as $$
declare
  c cases%rowtype;
  v_org uuid := auth_user_org_id();
  v_role user_role := auth_user_role();
begin
  select * into c from cases where id = p_case_id for update;
  if not found then raise exception 'Case not found'; end if;
  if c.clinic_org_id <> v_org then raise exception 'Not your case'; end if;
  if v_role not in ('clinic_admin', 'doctor', 'secretary') then raise exception 'Not allowed'; end if;
  if c.status not in ('draft', 'pending', 'declined') then
    raise exception 'Cannot cancel in status %', c.status;
  end if;

  update cases set status = 'cancelled' where id = p_case_id returning * into c;
  return c;
end;
$$;

-- ---------------------------------------------------------------------------
-- Connection helpers
-- ---------------------------------------------------------------------------
create or replace function respond_connection(p_connection_id uuid, p_accept boolean)
returns connections
language plpgsql
security definer
set search_path = public
as $$
declare
  cn connections%rowtype;
  v_org uuid := auth_user_org_id();
  v_role user_role := auth_user_role();
  v_uid uuid := auth.uid();
  v_requester uuid;
begin
  select * into cn from connections where id = p_connection_id for update;
  if not found then raise exception 'Connection not found'; end if;
  if cn.lab_org_id <> v_org then raise exception 'Only the receiving lab can respond'; end if;
  if v_role <> 'lab_admin' then raise exception 'Only a lab admin can respond'; end if;
  if cn.status <> 'pending' then raise exception 'Connection already %', cn.status; end if;

  update connections
    set status = case when p_accept then 'active'::connection_status else 'blocked'::connection_status end,
        responded_by = v_uid,
        responded_at = now()
    where id = p_connection_id
    returning * into cn;

  if p_accept then
    v_requester := cn.requested_by;
    perform enqueue_notification(v_requester, 'connection_accepted', null,
      jsonb_build_object('lab_org_id', cn.lab_org_id));
  end if;
  return cn;
end;
$$;
