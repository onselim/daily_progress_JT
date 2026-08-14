-- Field engineers can now delete photos too, not just admins.
-- (public.photos row deletion was already allowed for both roles via the
-- "admins and field engineers manage photos" policy; this was the one
-- remaining gap, on the underlying storage.objects file.)
drop policy if exists "admins delete project media" on storage.objects;

create policy "admins and field engineers delete project media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'project-media'
    and public.has_project_role(
      ((storage.foldername(name))[1])::uuid,
      array['admin', 'field_engineer']::public.user_role[]
    )
  );
