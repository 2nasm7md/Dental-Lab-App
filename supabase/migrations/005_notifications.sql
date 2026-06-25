-- ============================================================================
-- Phase 2 — fan out the remaining notification triggers:
--   * new_message       on case_messages insert
--   * connection_request on connections insert (status = pending)
--   * payment_updated   on cases update of price or payment_status
-- Plus realtime publication for the notifications table.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Recipients-of-a-case helper
-- Returns every user id that should be notified about activity on a case,
-- excluding a given sender (the actor who caused the event).
-- ---------------------------------------------------------------------------
create or replace function case_recipients(p_case_id uuid, p_exclude uuid)
returns setof uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c cases%rowtype;
begin
  select * into c from cases where id = p_case_id;
  if not found then return; end if;

  -- Clinic side: owner doctor + creator (and admin if not same).
  return query
    select id from users
    where organization_id = c.clinic_org_id
      and id in (c.owner_doctor_id, c.created_by)
      and id is distinct from p_exclude
      and is_active;

  -- Lab side: lab admins + assigned technician (only after the case left draft)
  if c.status <> 'draft' and c.lab_org_id is not null then
    return query
      select id from users
      where organization_id = c.lab_org_id
        and (role = 'lab_admin' or id = c.assigned_technician_id)
        and id is distinct from p_exclude
        and is_active;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- new_message
-- ---------------------------------------------------------------------------
create or replace function notify_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient uuid;
  v_case_number text;
begin
  select case_number into v_case_number from cases where id = new.case_id;
  for v_recipient in select * from case_recipients(new.case_id, new.sender_id) loop
    perform enqueue_notification(
      v_recipient,
      'new_message',
      new.case_id,
      jsonb_build_object('case_number', v_case_number, 'preview', left(new.body, 120))
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists case_messages_notify on case_messages;
create trigger case_messages_notify
  after insert on case_messages
  for each row execute function notify_on_message();

-- ---------------------------------------------------------------------------
-- connection_request
-- ---------------------------------------------------------------------------
create or replace function notify_on_connection_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient uuid;
  v_clinic_name text;
begin
  if new.status <> 'pending' then return new; end if;
  select name into v_clinic_name from organizations where id = new.clinic_org_id;
  for v_recipient in
    select id from users
    where organization_id = new.lab_org_id and role = 'lab_admin' and is_active
  loop
    perform enqueue_notification(
      v_recipient,
      'connection_request',
      null,
      jsonb_build_object(
        'connection_id', new.id,
        'clinic_org_id', new.clinic_org_id,
        'clinic_name', v_clinic_name
      )
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists connections_notify_request on connections;
create trigger connections_notify_request
  after insert on connections
  for each row execute function notify_on_connection_request();

-- ---------------------------------------------------------------------------
-- payment_updated
-- ---------------------------------------------------------------------------
create or replace function notify_on_payment_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient uuid;
  v_actor uuid := auth.uid();
begin
  if (new.price is not distinct from old.price)
     and (new.payment_status is not distinct from old.payment_status) then
    return new;
  end if;
  for v_recipient in select * from case_recipients(new.id, v_actor) loop
    perform enqueue_notification(
      v_recipient,
      'payment_updated',
      new.id,
      jsonb_build_object(
        'case_number', new.case_number,
        'price', new.price,
        'payment_status', new.payment_status
      )
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists cases_notify_payment on cases;
create trigger cases_notify_payment
  after update of price, payment_status on cases
  for each row execute function notify_on_payment_update();

-- ---------------------------------------------------------------------------
-- Realtime publication so the client can subscribe to notifications
-- and case_messages without polling.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notifications'
  ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'case_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.case_messages';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'cases'
  ) then
    execute 'alter publication supabase_realtime add table public.cases';
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- mark_all_notifications_read RPC — bulk action for the bell
-- ---------------------------------------------------------------------------
create or replace function mark_all_notifications_read()
returns void
language sql
security definer
set search_path = public
as $$
  update notifications set is_read = true
  where recipient_user_id = auth.uid() and is_read = false;
$$;
