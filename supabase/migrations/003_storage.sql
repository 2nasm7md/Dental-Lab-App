-- ============================================================================
--  003_storage.sql — Supabase Storage buckets and policies.
-- ============================================================================

-- Public buckets (CDN-cached, RLS still enforces write access per tenant).
insert into storage.buckets (id, name, public)
values
    ('doctor-photos', 'doctor-photos', true),
    ('clinic-logos',  'clinic-logos',  true),
    ('portfolio',     'portfolio',     true)
on conflict (id) do nothing;

-- Convention: first path segment is the tenant_id.
--   <tenant_id>/<file>.jpg
-- This makes RLS predicates trivial and self-documenting.

-- read: anyone can read (public bucket); object listing remains gated.
create policy "public read doctor-photos" on storage.objects
    for select using (bucket_id = 'doctor-photos');

create policy "public read clinic-logos" on storage.objects
    for select using (bucket_id = 'clinic-logos');

create policy "public read portfolio" on storage.objects
    for select using (bucket_id = 'portfolio');

-- write: must belong to the tenant whose id matches the first folder segment.
create policy "tenant write doctor-photos" on storage.objects
    for all to authenticated
    using (
        bucket_id = 'doctor-photos'
        and (split_part(name, '/', 1))::uuid in (select auth_tenant_ids())
    )
    with check (
        bucket_id = 'doctor-photos'
        and (split_part(name, '/', 1))::uuid in (select auth_tenant_ids())
    );

create policy "tenant write clinic-logos" on storage.objects
    for all to authenticated
    using (
        bucket_id = 'clinic-logos'
        and (split_part(name, '/', 1))::uuid in (select auth_tenant_ids())
    )
    with check (
        bucket_id = 'clinic-logos'
        and (split_part(name, '/', 1))::uuid in (select auth_tenant_ids())
    );

create policy "tenant write portfolio" on storage.objects
    for all to authenticated
    using (
        bucket_id = 'portfolio'
        and (split_part(name, '/', 1))::uuid in (select auth_tenant_ids())
    )
    with check (
        bucket_id = 'portfolio'
        and (split_part(name, '/', 1))::uuid in (select auth_tenant_ids())
    );
