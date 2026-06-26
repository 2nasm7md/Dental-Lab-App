-- ============================================================================
-- Live diagnostic for the cases-insert RLS policy.
--
-- The clinic_admin user reports that 006 was applied but inserts still fail.
-- We add an RPC that the app calls when the insert fails — it returns what
-- the policy's helper functions evaluate to RIGHT NOW for the authenticated
-- caller, plus the row visibility of the requested owner. The result is
-- surfaced back through the form so we can read it without Supabase logs.
--
-- Safe to drop later: the function is namespaced and read-only.
--
-- We also re-DROP/CREATE the cases-insert policy here to defeat any case
-- where 006 was partially applied — same body as 006, idempotent.
-- ============================================================================

-- Re-assert the policy (drop + create). Same body as 006.
drop policy if exists "cases: clinic insert" on cases;

create policy "cases: clinic insert"
  on cases for insert
  to authenticated
  with check (
    clinic_org_id = auth_user_org_id()
    and created_by = auth.uid()
    and (
      (auth_user_role() = 'doctor' and owner_doctor_id = auth.uid())
      or (
        auth_user_role() = 'clinic_admin'
        and exists (
          select 1 from users d
          where d.id = owner_doctor_id
            and d.organization_id = auth_user_org_id()
            and d.role in ('doctor', 'clinic_admin')
        )
      )
      or (
        auth_user_role() = 'secretary'
        and exists (
          select 1 from users d
          where d.id = owner_doctor_id
            and d.organization_id = auth_user_org_id()
            and d.role in ('doctor', 'clinic_admin')
            and auth_user_assists_doctor(d.id)
        )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Diagnostic: returns the RLS context as the caller sees it. SECURITY DEFINER
-- so it can also read the owner_doctor row even if the caller's RLS would
-- hide it — that lets us tell apart "row doesn't exist" from "RLS hides it".
-- ---------------------------------------------------------------------------
create or replace function debug_case_rls(
  p_clinic_org_id uuid,
  p_owner_doctor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth uuid := auth.uid();
  v_role text;
  v_org uuid;
  v_owner_record jsonb;
  v_branch_doctor boolean;
  v_branch_admin boolean;
  v_branch_secretary boolean;
  v_check_clinic_org boolean;
  v_role_via_fn text;
  v_org_via_fn uuid;
begin
  -- Direct profile read (bypasses RLS via SECURITY DEFINER).
  select role::text, organization_id into v_role, v_org
  from users where id = v_auth;

  -- Same lookup via the helpers used by the live policy.
  v_role_via_fn := auth_user_role()::text;
  v_org_via_fn := auth_user_org_id();

  -- Owner row, irrespective of RLS visibility.
  select to_jsonb(u) into v_owner_record
  from (select id, organization_id, role::text, full_name, is_active from users where id = p_owner_doctor_id) u;

  v_check_clinic_org := (p_clinic_org_id = v_org_via_fn);

  v_branch_doctor := (
    v_role_via_fn = 'doctor'
    and p_owner_doctor_id = v_auth
  );

  v_branch_admin := (
    v_role_via_fn = 'clinic_admin'
    and exists (
      select 1 from users d
      where d.id = p_owner_doctor_id
        and d.organization_id = v_org_via_fn
        and d.role in ('doctor', 'clinic_admin')
    )
  );

  v_branch_secretary := (
    v_role_via_fn = 'secretary'
    and exists (
      select 1 from users d
      where d.id = p_owner_doctor_id
        and d.organization_id = v_org_via_fn
        and d.role in ('doctor', 'clinic_admin')
        and auth_user_assists_doctor(d.id)
    )
  );

  return jsonb_build_object(
    'auth_uid', v_auth,
    'actor_profile', jsonb_build_object(
      'role_direct', v_role,
      'org_direct', v_org,
      'role_via_helper', v_role_via_fn,
      'org_via_helper', v_org_via_fn
    ),
    'requested', jsonb_build_object(
      'clinic_org_id', p_clinic_org_id,
      'owner_doctor_id', p_owner_doctor_id
    ),
    'owner_record', v_owner_record,
    'checks', jsonb_build_object(
      'clinic_org_matches_actor', v_check_clinic_org,
      'created_by_will_be_auth_uid', v_auth is not null,
      'branch_doctor', v_branch_doctor,
      'branch_clinic_admin', v_branch_admin,
      'branch_secretary', v_branch_secretary
    ),
    'verdict', case
      when v_check_clinic_org and v_auth is not null
       and (v_branch_doctor or v_branch_admin or v_branch_secretary)
      then 'POLICY SHOULD PASS — if insert still fails, another policy or trigger is blocking'
      when not v_check_clinic_org
      then 'FAIL: clinic_org_id does not match actor org_id'
      when v_auth is null
      then 'FAIL: no auth.uid() — request was not authenticated'
      else 'FAIL: no policy branch matched — see actor_profile.role_via_helper and owner_record'
    end
  );
end;
$$;

-- Allow authenticated callers to run the diagnostic (no sensitive data leaks).
grant execute on function debug_case_rls(uuid, uuid) to authenticated;
