-- ============================================================================
-- The cases-insert policy keeps failing from plpgsql / supabase-js paths even
-- when every with_check clause evaluates true in standalone probes. This is
-- not unique to this app — Postgres RLS + plpgsql + multi-table EXISTS
-- subqueries inside the policy can fail when invoked through the SPI
-- (prepared) path, even though they pass at top level.
--
-- The pattern this codebase already uses for state transitions
-- (send_case, accept_case, advance_case, etc.) is to expose a SECURITY
-- DEFINER RPC that performs both authorization and the write. That is
-- bulletproof regardless of how it's called. We do the same for case
-- creation here.
--
-- Net effect:
--   * The cases-insert RLS policy becomes "deny everything via direct
--     INSERT — the only path is the create_case() RPC".
--   * create_case(...) does all the authorization the policy used to do,
--     then performs the insert as a definer (RLS-bypassing) write.
-- ============================================================================

-- Replace the policy with a deny-all. Direct INSERTs into cases will be
-- rejected; the only way to create a case is through create_case().
drop policy if exists "cases: clinic insert" on cases;

create policy "cases: clinic insert"
  on cases for insert
  to authenticated
  with check (false);

-- ---------------------------------------------------------------------------
-- create_case — server-enforced case creation. Returns the new case_id.
-- All previous authorization rules live here, plus the optional initial send.
-- ---------------------------------------------------------------------------
create or replace function create_case(
  p_owner_doctor_id uuid,
  p_lab_org_id uuid default null,
  p_patient_name text default null,
  p_patient_ref text default null,
  p_tooth_numbers text[] default '{}'::text[],
  p_restoration_type restoration_type default null,
  p_material material_type default null,
  p_shade text default null,
  p_due_date date default null,
  p_doctor_notes text default null,
  p_price numeric default null,
  p_currency text default null,
  p_send boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_actor_role user_role;
  v_actor_org uuid;
  v_owner record;
  v_case_id uuid;
  v_payment payment_status;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select role, organization_id into v_actor_role, v_actor_org
  from users where id = v_uid;

  if v_actor_org is null or v_actor_role is null then
    raise exception 'No organization or role for caller' using errcode = '42501';
  end if;

  if v_actor_role not in ('clinic_admin', 'doctor', 'secretary') then
    raise exception 'Only clinic users can create cases' using errcode = '42501';
  end if;

  -- Owner resolution + per-role authorization.
  select id, organization_id, role, is_active into v_owner
  from users where id = p_owner_doctor_id;

  if v_owner.id is null then
    raise exception 'owner_doctor_id % does not exist', p_owner_doctor_id using errcode = '23503';
  end if;
  if v_owner.organization_id is distinct from v_actor_org then
    raise exception 'owner_doctor_id is not in your clinic' using errcode = '42501';
  end if;
  if not v_owner.is_active then
    raise exception 'owner_doctor_id is not active' using errcode = '42501';
  end if;
  if v_owner.role not in ('doctor', 'clinic_admin') then
    raise exception 'owner_doctor_id must be a doctor or clinic_admin' using errcode = '42501';
  end if;

  if v_actor_role = 'doctor' and p_owner_doctor_id <> v_uid then
    raise exception 'Doctors can only own their own cases' using errcode = '42501';
  end if;
  if v_actor_role = 'secretary' and not auth_user_assists_doctor(p_owner_doctor_id) then
    raise exception 'Secretary does not assist this doctor' using errcode = '42501';
  end if;

  -- If a lab is provided, verify there's an active connection.
  if p_lab_org_id is not null then
    if not exists (
      select 1 from connections
      where clinic_org_id = v_actor_org
        and lab_org_id = p_lab_org_id
        and status = 'active'
    ) then
      raise exception 'No active connection with the chosen lab' using errcode = '42501';
    end if;
  end if;

  v_payment := case when p_price is not null then 'unpaid'::payment_status else null end;

  insert into cases (
    clinic_org_id, lab_org_id, owner_doctor_id, created_by, status,
    patient_name, patient_ref, tooth_numbers,
    restoration_type, material, shade, due_date, doctor_notes,
    price, currency, payment_status
  ) values (
    v_actor_org, p_lab_org_id, p_owner_doctor_id, v_uid, 'draft',
    nullif(p_patient_name, ''), nullif(p_patient_ref, ''), coalesce(p_tooth_numbers, '{}'::text[]),
    p_restoration_type, p_material, nullif(p_shade, ''), p_due_date, nullif(p_doctor_notes, ''),
    p_price,
    coalesce(nullif(p_currency, ''), (select currency from organizations where id = v_actor_org)),
    v_payment
  )
  returning id into v_case_id;

  if p_send and p_lab_org_id is not null then
    perform send_case(v_case_id);
  end if;

  return v_case_id;
end;
$$;

grant execute on function create_case(uuid, uuid, text, text, text[], restoration_type, material_type, text, date, text, numeric, text, boolean) to authenticated;
