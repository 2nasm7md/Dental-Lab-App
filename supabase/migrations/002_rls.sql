-- ============================================================================
--  002_rls.sql — Row Level Security.
--
--  Pattern:
--    * Members of a tenant can read/write their tenant's rows.
--    * Anonymous visitors can read the *public profile* of a tenant
--      (settings, doctors, visit_types, portfolio) IFF tenants.public = true.
--    * Anonymous visitors can INSERT into appointments via a SECURITY DEFINER
--      RPC (`book_appointment`); they cannot insert directly.
-- ============================================================================

alter table tenants            enable row level security;
alter table tenant_users       enable row level security;
alter table doctors            enable row level security;
alter table visit_types        enable row level security;
alter table schedule_days      enable row level security;
alter table schedule_breaks    enable row level security;
alter table schedule_absences  enable row level security;
alter table appointments       enable row level security;
alter table portfolio_cases    enable row level security;
alter table clinic_settings    enable row level security;
alter table subscriptions      enable row level security;

-- ----------------------------------------------------------------------------
--  tenants
-- ----------------------------------------------------------------------------
create policy tenants_member_select on tenants
    for select using ( id in (select auth_tenant_ids()) );

create policy tenants_public_select on tenants
    for select to anon
    using (public = true);

create policy tenants_owner_update on tenants
    for update using ( has_role(id, 'owner') )
                with check ( has_role(id, 'owner') );

create policy tenants_owner_delete on tenants
    for delete using ( has_role(id, 'owner') );

-- ----------------------------------------------------------------------------
--  tenant_users
-- ----------------------------------------------------------------------------
create policy tenant_users_self_select on tenant_users
    for select using ( user_id = auth.uid()
                       or tenant_id in (select auth_tenant_ids()) );

create policy tenant_users_owner_insert on tenant_users
    for insert with check ( has_role(tenant_id, 'owner') );

create policy tenant_users_owner_update on tenant_users
    for update using ( has_role(tenant_id, 'owner') )
                with check ( has_role(tenant_id, 'owner') );

create policy tenant_users_owner_delete on tenant_users
    for delete using ( has_role(tenant_id, 'owner') );

-- ----------------------------------------------------------------------------
--  doctors
-- ----------------------------------------------------------------------------
create policy doctors_member_select on doctors
    for select using ( tenant_id in (select auth_tenant_ids()) );

create policy doctors_public_select on doctors
    for select to anon using (
        active = true
        and exists (select 1 from tenants t
                    where t.id = doctors.tenant_id and t.public = true)
    );

create policy doctors_mgmt on doctors
    for all using ( has_role(tenant_id, 'owner', 'admin') )
            with check ( has_role(tenant_id, 'owner', 'admin') );

-- ----------------------------------------------------------------------------
--  visit_types
-- ----------------------------------------------------------------------------
create policy visit_types_member_select on visit_types
    for select using ( tenant_id in (select auth_tenant_ids()) );

create policy visit_types_public_select on visit_types
    for select to anon using (
        active = true
        and exists (select 1 from tenants t
                    where t.id = visit_types.tenant_id and t.public = true)
    );

create policy visit_types_mgmt on visit_types
    for all using ( has_role(tenant_id, 'owner', 'admin') )
            with check ( has_role(tenant_id, 'owner', 'admin') );

-- ----------------------------------------------------------------------------
--  schedule_days / schedule_breaks / schedule_absences
--  Public can read schedule_days only (for the booking flow's availability
--  computation). Breaks/absences only via the RPC.
-- ----------------------------------------------------------------------------
create policy schedule_days_member_select on schedule_days
    for select using ( tenant_id in (select auth_tenant_ids()) );

create policy schedule_days_public_select on schedule_days
    for select to anon using (
        exists (select 1 from tenants t
                where t.id = schedule_days.tenant_id and t.public = true)
    );

create policy schedule_days_mgmt on schedule_days
    for all using ( has_role(tenant_id, 'owner', 'admin') )
            with check ( has_role(tenant_id, 'owner', 'admin') );

create policy schedule_breaks_member_select on schedule_breaks
    for select using ( tenant_id in (select auth_tenant_ids()) );

create policy schedule_breaks_mgmt on schedule_breaks
    for all using ( has_role(tenant_id, 'owner', 'admin') )
            with check ( has_role(tenant_id, 'owner', 'admin') );

create policy schedule_absences_member_select on schedule_absences
    for select using ( tenant_id in (select auth_tenant_ids()) );

create policy schedule_absences_mgmt on schedule_absences
    for all using ( has_role(tenant_id, 'owner', 'admin') )
            with check ( has_role(tenant_id, 'owner', 'admin') );

-- ----------------------------------------------------------------------------
--  appointments
--  Members can read/manage. Anonymous booking goes through book_appointment().
-- ----------------------------------------------------------------------------
create policy appointments_member_select on appointments
    for select using ( tenant_id in (select auth_tenant_ids()) );

create policy appointments_mgmt on appointments
    for all using ( has_role(tenant_id, 'owner', 'admin', 'receptionist') )
            with check ( has_role(tenant_id, 'owner', 'admin', 'receptionist') );

-- ----------------------------------------------------------------------------
--  portfolio_cases
-- ----------------------------------------------------------------------------
create policy portfolio_member_select on portfolio_cases
    for select using ( tenant_id in (select auth_tenant_ids()) );

create policy portfolio_public_select on portfolio_cases
    for select to anon using (
        exists (select 1 from tenants t
                where t.id = portfolio_cases.tenant_id and t.public = true)
    );

create policy portfolio_mgmt on portfolio_cases
    for all using ( has_role(tenant_id, 'owner', 'admin') )
            with check ( has_role(tenant_id, 'owner', 'admin') );

-- ----------------------------------------------------------------------------
--  clinic_settings
-- ----------------------------------------------------------------------------
create policy clinic_settings_member_select on clinic_settings
    for select using ( tenant_id in (select auth_tenant_ids()) );

create policy clinic_settings_public_select on clinic_settings
    for select to anon using (
        exists (select 1 from tenants t
                where t.id = clinic_settings.tenant_id and t.public = true)
    );

create policy clinic_settings_mgmt on clinic_settings
    for all using ( has_role(tenant_id, 'owner', 'admin') )
            with check ( has_role(tenant_id, 'owner', 'admin') );

-- ----------------------------------------------------------------------------
--  subscriptions
-- ----------------------------------------------------------------------------
create policy subscriptions_member_select on subscriptions
    for select using ( tenant_id in (select auth_tenant_ids()) );

create policy subscriptions_owner_mgmt on subscriptions
    for all using ( has_role(tenant_id, 'owner') )
            with check ( has_role(tenant_id, 'owner') );
