-- ============================================================================
-- Storage buckets and policies for case attachments and avatars/logos
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('case-attachments', 'case-attachments', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('org-logos', 'org-logos', true)
on conflict (id) do nothing;

-- Path convention for case-attachments: cases/<case_id>/<filename>
-- A user can read if they can view the case.
-- A user can upload if they can view the case.

create policy "case attachments: read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'case-attachments'
    and can_view_case(((storage.foldername(name))[2])::uuid)
  );

create policy "case attachments: upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'case-attachments'
    and can_view_case(((storage.foldername(name))[2])::uuid)
  );

create policy "case attachments: delete own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'case-attachments'
    and owner = auth.uid()
    and can_view_case(((storage.foldername(name))[2])::uuid)
  );

create policy "avatars: read public"
  on storage.objects for select
  to authenticated, anon
  using (bucket_id = 'avatars');

create policy "avatars: write own"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and owner = auth.uid());

create policy "org logos: read public"
  on storage.objects for select
  to authenticated, anon
  using (bucket_id = 'org-logos');

create policy "org logos: write by admin"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'org-logos'
    and auth_user_role() in ('clinic_admin', 'lab_admin')
  );
