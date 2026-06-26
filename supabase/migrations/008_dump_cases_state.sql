-- ============================================================================
-- Tell us exactly what's on the cases table right now.
--
-- The diagnostic in 007 says "POLICY SHOULD PASS" but inserts still fail.
-- Possible culprits we haven't seen yet:
--   * A different/stale policy on cases that doesn't match what 006/007 wrote
--   * A trigger whose own write hits an RLS wall (likely
--     record_case_status_change → case_status_history, which has no INSERT
--     policy)
--   * A CHECK constraint we forgot
--
-- This migration:
--   1. Fixes the most likely real cause: there is no INSERT policy on
--      case_status_history, so the AFTER-INSERT trigger on `cases` cannot
--      write its history row → whole transaction aborts and the error
--      surfaces against `cases`.
--   2. Adds three RPCs the app can call to verify state:
--        debug_cases_policies()   — list every policy on public.cases
--        debug_cases_triggers()   — list every trigger on public.cases
--        debug_try_case_insert()  — actually attempt the insert as the
--          calling user, capture the exception, and return sqlstate /
--          message / table_name / column_name / detail / hint
-- ============================================================================

-- ---------------------------------------------------------------------------
-- The likely real fix: history needs an INSERT policy.
-- The audit trail is written by an AFTER-INSERT trigger on `cases`.
-- That trigger runs as the caller and is subject to case_status_history RLS.
-- Without an INSERT policy here, every case insert silently breaks at the
-- trigger step.
-- ---------------------------------------------------------------------------
drop policy if exists "history: insert via trigger" on case_status_history;

create policy "history: insert via trigger"
  on case_status_history for insert
  to authenticated
  with check (
    -- Caller must be allowed to view the case the history row belongs to;
    -- the case has already been inserted by this point in the trigger.
    can_view_case(case_id)
  );

-- Make the recorder function SECURITY DEFINER so it doesn't depend on the
-- caller's RLS at all. The trigger is fired by our own server-side flow;
-- there is no risk of arbitrary callers writing history without a case
-- because the trigger only fires on cases inserts/updates.
create or replace function record_case_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
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

-- ---------------------------------------------------------------------------
-- Diagnostic: dump every policy on cases
-- ---------------------------------------------------------------------------
create or replace function debug_cases_policies()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
  from (
    select policyname, permissive, roles, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public' and tablename = 'cases'
    order by cmd, policyname
  ) p;
$$;

grant execute on function debug_cases_policies() to authenticated;

-- ---------------------------------------------------------------------------
-- Diagnostic: dump every trigger on cases (incl. their function definitions)
-- ---------------------------------------------------------------------------
create or replace function debug_cases_triggers()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
  from (
    select
      t.tgname as trigger_name,
      t.tgenabled as enabled,
      pg_get_triggerdef(t.oid) as definition,
      p.prosrc as function_body,
      case when p.prosecdef then 'security definer' else 'security invoker' end as security
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'public.cases'::regclass
      and not t.tgisinternal
    order by t.tgname
  ) t;
$$;

grant execute on function debug_cases_triggers() to authenticated;

-- ---------------------------------------------------------------------------
-- Diagnostic: actually attempt the insert as the caller. RLS applies because
-- this function is SECURITY INVOKER. Catches the exception and returns the
-- full error context so we can tell exactly which table / column / policy
-- aborted the transaction.
-- ---------------------------------------------------------------------------
create or replace function debug_try_case_insert(
  p_clinic_org_id uuid,
  p_owner_doctor_id uuid,
  p_lab_org_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_sqlstate text;
  v_message text;
  v_detail text;
  v_hint text;
  v_table text;
  v_schema text;
  v_column text;
  v_constraint text;
begin
  insert into cases (
    clinic_org_id, lab_org_id, owner_doctor_id, created_by,
    status, tooth_numbers, patient_name
  ) values (
    p_clinic_org_id, p_lab_org_id, p_owner_doctor_id, auth.uid(),
    'draft', '{}'::text[], '__debug__'
  )
  returning id into v_id;

  -- If we got here the insert (and any triggers) succeeded. Roll the
  -- diagnostic row back so we don't pollute the table.
  delete from cases where id = v_id;
  return jsonb_build_object('ok', true, 'case_id', v_id, 'note', 'diagnostic row deleted');

exception when others then
  get stacked diagnostics
    v_sqlstate = returned_sqlstate,
    v_message = message_text,
    v_detail = pg_exception_detail,
    v_hint = pg_exception_hint,
    v_schema = schema_name,
    v_table = table_name,
    v_column = column_name,
    v_constraint = constraint_name;
  return jsonb_build_object(
    'ok', false,
    'sqlstate', v_sqlstate,
    'message', v_message,
    'detail', v_detail,
    'hint', v_hint,
    'schema_name', v_schema,
    'table_name', v_table,
    'column_name', v_column,
    'constraint_name', v_constraint
  );
end;
$$;

grant execute on function debug_try_case_insert(uuid, uuid, uuid) to authenticated;
