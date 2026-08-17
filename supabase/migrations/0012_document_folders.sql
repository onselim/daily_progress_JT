-- document_folders: user-created groupings within a project's "Project documents" panel.
create table public.document_folders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index on public.document_folders (project_id);

alter table public.documents
  add column folder_id uuid references public.document_folders(id) on delete cascade;

alter table public.document_folders enable row level security;

create policy "anyone can view folders of published projects"
  on public.document_folders for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = document_folders.project_id and p.is_public = true and p.is_active = true
    )
  );

create policy "members can view folders"
  on public.document_folders for select
  to authenticated
  using (public.has_project_role(project_id, array['admin', 'field_engineer', 'viewer']::public.user_role[]));

create policy "admins and field engineers manage folders"
  on public.document_folders for all
  to authenticated
  using (public.has_project_role(project_id, array['admin', 'field_engineer']::public.user_role[]))
  with check (public.has_project_role(project_id, array['admin', 'field_engineer']::public.user_role[]));
