-- ============================================================================
-- Sample seed data for the Dental Lab Platform.
--
-- Run AFTER applying migrations 001 → 002 → 003 → 005 (and optionally 004).
-- Paste in the Supabase SQL editor (or run with a service-role psql session).
-- Idempotent: every insert uses ON CONFLICT DO NOTHING / DO UPDATE, so
-- re-running is safe and will not duplicate rows.
--
-- Every seeded user shares the password:  Test1234!
--
-- Quick start logins:
--   Clinic admin (Smile Clinic):     admin@smile-clinic.test
--   Doctor       (Smile Clinic):     ahmed@smile-clinic.test
--   Secretary    (Smile Clinic):     secretary@smile-clinic.test
--   Clinic admin (Care Center):      admin@care-center.test  (all_doctors_see_all_cases)
--   Lab admin   (Advanced Lab):      admin@advanced-lab.test
--   Technician  (Advanced Lab):      tech1@advanced-lab.test
--   Lab admin   (Noor Lab):          admin@noor-lab.test
--   Lab admin   (Precision Lab):     admin@precision-lab.test
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Organizations: 3 labs + 2 clinics
-- ---------------------------------------------------------------------------
insert into organizations (id, type, name, phone, email, address, currency, settings) values
  ('aaaaaaaa-0000-0000-0000-000000000a01', 'lab', 'مختبر الأسنان المتقدم',
   '+201000000101', 'info@advanced-lab.test', 'القاهرة - مدينة نصر', 'EGP',
   jsonb_build_object(
     'all_doctors_see_all_cases', false,
     'cost_tracking_enabled', true,
     'pending_timeout_hours', 48,
     'techs_see_unassigned', true
   )),
  ('aaaaaaaa-0000-0000-0000-000000000a02', 'lab', 'مختبر النور',
   '+201000000102', 'info@noor-lab.test', 'الإسكندرية - سموحة', 'EGP',
   jsonb_build_object(
     'all_doctors_see_all_cases', false,
     'cost_tracking_enabled', true,
     'pending_timeout_hours', 48,
     'techs_see_unassigned', true
   )),
  ('aaaaaaaa-0000-0000-0000-000000000a03', 'lab', 'مختبر الدقة',
   '+201000000103', 'info@precision-lab.test', 'الجيزة - المهندسين', 'EGP',
   jsonb_build_object(
     'all_doctors_see_all_cases', false,
     'cost_tracking_enabled', true,
     'pending_timeout_hours', 48,
     'techs_see_unassigned', false
   )),
  ('bbbbbbbb-0000-0000-0000-000000000c01', 'clinic', 'عيادة الابتسامة',
   '+201000000201', 'info@smile-clinic.test', 'القاهرة - الزمالك', 'EGP',
   jsonb_build_object(
     'all_doctors_see_all_cases', false,
     'cost_tracking_enabled', true,
     'pending_timeout_hours', 48,
     'techs_see_unassigned', true
   )),
  ('bbbbbbbb-0000-0000-0000-000000000c02', 'clinic', 'مركز الرعاية للأسنان',
   '+201000000202', 'info@care-center.test', 'الإسكندرية - رشدي', 'EGP',
   jsonb_build_object(
     'all_doctors_see_all_cases', true,
     'cost_tracking_enabled', true,
     'pending_timeout_hours', 48,
     'techs_see_unassigned', true
   ))
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Helper: create matching auth.users + public.users rows.
-- The function is dropped at the end so it doesn't linger in the schema.
-- ---------------------------------------------------------------------------
create or replace function _seed_user(
  p_id uuid,
  p_email text,
  p_full_name text,
  p_org_id uuid,
  p_role user_role,
  p_assists uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
as $fn$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    p_id, 'authenticated', 'authenticated',
    p_email, crypt('Test1234!', gen_salt('bf')), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('full_name', p_full_name),
    now(), now(),
    '', '', '', ''
  )
  on conflict (id) do update
    set email = excluded.email,
        encrypted_password = excluded.encrypted_password,
        email_confirmed_at = excluded.email_confirmed_at;

  insert into public.users
    (id, organization_id, role, full_name, is_active, assists_doctor_ids)
  values
    (p_id, p_org_id, p_role, p_full_name, true, p_assists)
  on conflict (id) do update
    set organization_id = excluded.organization_id,
        role = excluded.role,
        full_name = excluded.full_name,
        assists_doctor_ids = excluded.assists_doctor_ids;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Lab users
-- ---------------------------------------------------------------------------
-- Lab 1: مختبر الأسنان المتقدم
select _seed_user('11111111-0000-0000-0000-000000001001',
  'admin@advanced-lab.test', 'سامي المنصور',
  'aaaaaaaa-0000-0000-0000-000000000a01', 'lab_admin');
select _seed_user('11111111-0000-0000-0000-000000001002',
  'tech1@advanced-lab.test', 'علي حسن',
  'aaaaaaaa-0000-0000-0000-000000000a01', 'technician');
select _seed_user('11111111-0000-0000-0000-000000001003',
  'tech2@advanced-lab.test', 'محمد فاروق',
  'aaaaaaaa-0000-0000-0000-000000000a01', 'technician');

-- Lab 2: مختبر النور
select _seed_user('11111111-0000-0000-0000-000000001011',
  'admin@noor-lab.test', 'هدى السيد',
  'aaaaaaaa-0000-0000-0000-000000000a02', 'lab_admin');
select _seed_user('11111111-0000-0000-0000-000000001012',
  'tech1@noor-lab.test', 'كريم نبيل',
  'aaaaaaaa-0000-0000-0000-000000000a02', 'technician');

-- Lab 3: مختبر الدقة
select _seed_user('11111111-0000-0000-0000-000000001021',
  'admin@precision-lab.test', 'فهد القرشي',
  'aaaaaaaa-0000-0000-0000-000000000a03', 'lab_admin');
select _seed_user('11111111-0000-0000-0000-000000001022',
  'tech1@precision-lab.test', 'يوسف زكي',
  'aaaaaaaa-0000-0000-0000-000000000a03', 'technician');

-- ---------------------------------------------------------------------------
-- Clinic users
-- ---------------------------------------------------------------------------
-- Clinic 1: عيادة الابتسامة (per-doctor privacy)
select _seed_user('22222222-0000-0000-0000-000000002001',
  'admin@smile-clinic.test', 'د. خالد الراشد',
  'bbbbbbbb-0000-0000-0000-000000000c01', 'clinic_admin');
select _seed_user('22222222-0000-0000-0000-000000002002',
  'ahmed@smile-clinic.test', 'د. أحمد عبد العزيز',
  'bbbbbbbb-0000-0000-0000-000000000c01', 'doctor');
select _seed_user('22222222-0000-0000-0000-000000002003',
  'sara@smile-clinic.test', 'د. سارة درويش',
  'bbbbbbbb-0000-0000-0000-000000000c01', 'doctor');
-- Secretary scoped to both doctors at Smile Clinic
select _seed_user(
  '22222222-0000-0000-0000-000000002004',
  'secretary@smile-clinic.test', 'منى الشرقاوي',
  'bbbbbbbb-0000-0000-0000-000000000c01', 'secretary',
  array[
    '22222222-0000-0000-0000-000000002002'::uuid,
    '22222222-0000-0000-0000-000000002003'::uuid
  ]
);

-- Clinic 2: مركز الرعاية للأسنان (all_doctors_see_all_cases = true)
select _seed_user('22222222-0000-0000-0000-000000002011',
  'admin@care-center.test', 'د. ليلى الفهد',
  'bbbbbbbb-0000-0000-0000-000000000c02', 'clinic_admin');
select _seed_user('22222222-0000-0000-0000-000000002012',
  'omar@care-center.test', 'د. عمر السيد',
  'bbbbbbbb-0000-0000-0000-000000000c02', 'doctor');
-- Secretary assists all doctors (empty array)
select _seed_user('22222222-0000-0000-0000-000000002013',
  'secretary@care-center.test', 'هبة كمال',
  'bbbbbbbb-0000-0000-0000-000000000c02', 'secretary');

drop function _seed_user(uuid, text, text, uuid, user_role, uuid[]);

-- ---------------------------------------------------------------------------
-- Pre-active connections so clinics can immediately send cases
-- ---------------------------------------------------------------------------
insert into connections
  (clinic_org_id, lab_org_id, status, requested_by, responded_by, responded_at)
values
  -- Smile Clinic ↔ Advanced Lab
  ('bbbbbbbb-0000-0000-0000-000000000c01', 'aaaaaaaa-0000-0000-0000-000000000a01',
   'active', '22222222-0000-0000-0000-000000002001',
   '11111111-0000-0000-0000-000000001001', now()),
  -- Smile Clinic ↔ Noor Lab
  ('bbbbbbbb-0000-0000-0000-000000000c01', 'aaaaaaaa-0000-0000-0000-000000000a02',
   'active', '22222222-0000-0000-0000-000000002001',
   '11111111-0000-0000-0000-000000001011', now()),
  -- Care Center ↔ Noor Lab
  ('bbbbbbbb-0000-0000-0000-000000000c02', 'aaaaaaaa-0000-0000-0000-000000000a02',
   'active', '22222222-0000-0000-0000-000000002011',
   '11111111-0000-0000-0000-000000001011', now()),
  -- Care Center → Precision Lab (still pending, so the Accept flow is demo-able)
  ('bbbbbbbb-0000-0000-0000-000000000c02', 'aaaaaaaa-0000-0000-0000-000000000a03',
   'pending', '22222222-0000-0000-0000-000000002011', null, null)
on conflict (clinic_org_id, lab_org_id) do nothing;

-- ---------------------------------------------------------------------------
-- Identities: required by Supabase Auth for password sign-in to work.
-- Without an identity row, the GoTrue API treats the auth.users row as
-- "OAuth-only" and refuses the email/password flow.
-- ---------------------------------------------------------------------------
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(),
  u.id,
  u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  now(), now(), now()
from auth.users u
where u.email like '%@%-lab.test' or u.email like '%@smile-clinic.test' or u.email like '%@care-center.test'
on conflict (provider, provider_id) do nothing;
