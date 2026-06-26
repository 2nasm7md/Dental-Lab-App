-- ============================================================================
-- The cases insert policy worked from top-level SQL but failed from any
-- plpgsql context (DO blocks, SECURITY INVOKER functions, the supabase-js
-- bindings). All five conditions of WITH CHECK evaluate TRUE when run
-- manually inside the same plpgsql context — so the policy *should* pass —
-- but Postgres still rejected the row.
--
-- The reliable fix is to stop relying on RLS-on-users inside the cases
-- WITH CHECK and instead delegate the per-branch "is this owner valid?"
-- decision to SECURITY DEFINER helpers. The helpers bypass users RLS and
-- always evaluate auth.uid() in the calling-statement context.
-- ============================================================================

create or replace function actor_can_assign_owner(p_owner_doctor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Clinic admins can assign to any clinic_admin/doctor in their own org.
  select exists (
    select 1
    from users actor
    join users owner
      on owner.id = p_owner_doctor_id
     and owner.organization_id = actor.organization_id
     and owner.role in ('doctor', 'clinic_admin')
     and owner.is_active
    where actor.id = auth.uid()
      and actor.role = 'clinic_admin'
  )
$$;

create or replace function actor_secretary_can_assign(p_owner_doctor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from users actor
    join users owner
      on owner.id = p_owner_doctor_id
     and owner.organization_id = actor.organization_id
     and owner.role in ('doctor', 'clinic_admin')
     and owner.is_active
    where actor.id = auth.uid()
      and actor.role = 'secretary'
      and (
        cardinality(actor.assists_doctor_ids) = 0
        or owner.id = any (actor.assists_doctor_ids)
      )
  )
$$;

drop policy if exists "cases: clinic insert" on cases;

create policy "cases: clinic insert"
  on cases for insert
  to authenticated
  with check (
    clinic_org_id = auth_user_org_id()
    and created_by = auth.uid()
    and (
      (auth_user_role() = 'doctor' and owner_doctor_id = auth.uid())
      or (auth_user_role() = 'clinic_admin' and actor_can_assign_owner(owner_doctor_id))
      or (auth_user_role() = 'secretary' and actor_secretary_can_assign(owner_doctor_id))
    )
  );

grant execute on function actor_can_assign_owner(uuid) to authenticated;
grant execute on function actor_secretary_can_assign(uuid) to authenticated;
