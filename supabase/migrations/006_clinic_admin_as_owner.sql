-- ============================================================================
-- Allow clinic_admin to own cases themselves (solo clinics / admin-as-dentist).
--
-- Before: the cases insert policy required owner_doctor_id to be a user with
-- role = 'doctor'. A clinic_admin in a one-person clinic with no doctor row
-- couldn't insert any case → "new row violates row-level security policy".
--
-- After: clinic_admin and doctor are both valid case owners. Secretary still
-- needs the assists check.
-- ============================================================================

drop policy if exists "cases: clinic insert" on cases;

create policy "cases: clinic insert"
  on cases for insert
  to authenticated
  with check (
    clinic_org_id = auth_user_org_id()
    and created_by = auth.uid()
    and (
      -- Doctor creating a case they own.
      (auth_user_role() = 'doctor' and owner_doctor_id = auth.uid())
      -- Clinic admin: can own a case themselves OR assign it to any
      -- doctor / fellow admin in their clinic.
      or (
        auth_user_role() = 'clinic_admin'
        and exists (
          select 1 from users d
          where d.id = owner_doctor_id
            and d.organization_id = auth_user_org_id()
            and d.role in ('doctor', 'clinic_admin')
        )
      )
      -- Secretary: on behalf of a doctor/admin they assist.
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
