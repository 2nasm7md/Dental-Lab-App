-- ============================================================================
--  004_functions.sql — RPCs.
--
--  * provision_tenant — atomic signup: creates tenant + owner row + settings.
--  * lookup_appointments_by_phone — public phone search returning a curated
--    projection (no patient PII beyond what the caller already knows).
--  * book_appointment — public booking endpoint. Re-validates the slot under
--    an advisory lock to prevent races, then writes the appointment row.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  provision_tenant
-- ----------------------------------------------------------------------------
create or replace function provision_tenant(
    p_name        text,
    p_slug        text,
    p_full_name   text,
    p_email       text
)
returns table (tenant_id uuid, slug text)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_tenant_id uuid;
    v_user_id   uuid := auth.uid();
    v_slug      text := lower(regexp_replace(p_slug, '[^a-z0-9-]', '-', 'g'));
begin
    if v_user_id is null then
        raise exception 'unauthenticated';
    end if;

    -- Resolve slug collisions by appending a short random suffix.
    while exists (select 1 from tenants t where t.slug = v_slug) loop
        v_slug := left(v_slug, 40) || '-' || substr(md5(random()::text), 1, 4);
    end loop;

    insert into tenants (name, slug)
    values (p_name, v_slug)
    returning id into v_tenant_id;

    insert into tenant_users (tenant_id, user_id, role, full_name, email)
    values (v_tenant_id, v_user_id, 'owner', p_full_name, p_email);

    insert into clinic_settings (tenant_id, display_name)
    values (v_tenant_id, p_name);

    insert into subscriptions (tenant_id, plan, status)
    values (v_tenant_id, 'free', 'trialing');

    return query select v_tenant_id, v_slug;
end;
$$;

grant execute on function provision_tenant(text, text, text, text) to authenticated;

-- ----------------------------------------------------------------------------
--  lookup_appointments_by_phone — anon-callable phone search.
-- ----------------------------------------------------------------------------
create or replace function lookup_appointments_by_phone(
    p_tenant_slug text,
    p_phone       text
)
returns table (
    id            uuid,
    doctor_name   text,
    visit_type    text,
    start_at      timestamptz,
    end_at        timestamptz,
    status        appointment_status
)
language sql
stable
security definer
set search_path = public
as $$
    select a.id,
           d.name,
           v.name,
           a.start_at,
           a.end_at,
           a.status
    from appointments a
    join tenants t      on t.id = a.tenant_id
    join doctors d      on d.id = a.doctor_id
    join visit_types v  on v.id = a.visit_type_id
    where t.slug = p_tenant_slug
      and t.public = true
      and a.patient_phone = p_phone
    order by a.start_at desc
    limit 25;
$$;

grant execute on function lookup_appointments_by_phone(text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
--  book_appointment — anon-callable booking.
-- ----------------------------------------------------------------------------
create or replace function book_appointment(
    p_tenant_slug   text,
    p_doctor_id     uuid,
    p_visit_type_id uuid,
    p_start_at      timestamptz,
    p_patient_name  text,
    p_patient_phone text,
    p_patient_age   int,
    p_patient_gender patient_gender,
    p_patient_email text,
    p_notes         text
)
returns table (appointment_id uuid, start_at timestamptz, end_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_tenant_id uuid;
    v_duration  int;
    v_end_at    timestamptz;
    v_lock_key  bigint;
begin
    select id into v_tenant_id
    from tenants
    where slug = p_tenant_slug and public = true;

    if v_tenant_id is null then
        raise exception 'tenant_not_found_or_private';
    end if;

    -- Doctor and visit type must belong to the same tenant and be active.
    if not exists (
        select 1 from doctors
        where id = p_doctor_id and tenant_id = v_tenant_id and active = true
    ) then
        raise exception 'doctor_not_available';
    end if;

    select duration_minutes into v_duration
    from visit_types
    where id = p_visit_type_id and tenant_id = v_tenant_id and active = true;

    if v_duration is null then
        raise exception 'visit_type_not_available';
    end if;

    v_end_at := p_start_at + make_interval(mins => v_duration);

    -- Doctor-scoped advisory lock to serialise concurrent bookings.
    v_lock_key := ('x' || substr(md5(p_doctor_id::text), 1, 16))::bit(64)::bigint;
    perform pg_advisory_xact_lock(v_lock_key);

    -- Overlap check (defence-in-depth — the EXCLUDE constraint enforces this too).
    if exists (
        select 1 from appointments
        where doctor_id = p_doctor_id
          and status in ('confirmed', 'completed')
          and tstzrange(start_at, end_at, '[)') && tstzrange(p_start_at, v_end_at, '[)')
    ) then
        raise exception 'slot_unavailable';
    end if;

    -- Absences
    if exists (
        select 1 from schedule_absences
        where doctor_id = p_doctor_id
          and tstzrange(start_at, end_at, '[)') && tstzrange(p_start_at, v_end_at, '[)')
    ) then
        raise exception 'slot_unavailable';
    end if;

    -- Trim required fields.
    if coalesce(trim(p_patient_name), '') = '' then raise exception 'patient_name_required'; end if;
    if coalesce(trim(p_patient_phone), '') = '' then raise exception 'patient_phone_required'; end if;

    return query
    insert into appointments (
        tenant_id, doctor_id, visit_type_id,
        patient_name, patient_phone, patient_age, patient_gender, patient_email, notes,
        start_at, end_at, status
    ) values (
        v_tenant_id, p_doctor_id, p_visit_type_id,
        trim(p_patient_name), trim(p_patient_phone), p_patient_age, p_patient_gender,
        nullif(trim(p_patient_email), ''), nullif(trim(p_notes), ''),
        p_start_at, v_end_at, 'confirmed'
    )
    returning id, appointments.start_at, appointments.end_at;
end;
$$;

grant execute on function book_appointment(
    text, uuid, uuid, timestamptz, text, text, int, patient_gender, text, text
) to anon, authenticated;
