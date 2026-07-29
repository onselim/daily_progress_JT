-- Storage bucket for photos/documents.
-- Path convention: project-media/{project_id}/{asset_code}/{category}/{timestamp}.jpg
insert into storage.buckets (id, name, public)
values ('project-media', 'project-media', true)
on conflict (id) do nothing;

create policy "public read project media"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'project-media');

create policy "members upload project media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'project-media'
    and public.has_project_role(
      ((storage.foldername(name))[1])::uuid,
      array['admin', 'field_engineer']::public.user_role[]
    )
  );

create policy "members update own project media"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'project-media'
    and public.has_project_role(
      ((storage.foldername(name))[1])::uuid,
      array['admin', 'field_engineer']::public.user_role[]
    )
  );

create policy "admins delete project media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'project-media'
    and public.has_project_role(
      ((storage.foldername(name))[1])::uuid,
      array['admin']::public.user_role[]
    )
  );

-- Auto-create a profiles row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
