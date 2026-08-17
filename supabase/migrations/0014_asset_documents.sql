-- asset_documents: per-tower test reports/certificates (Soil Investigation Report,
-- Concrete Test Cube results, Backfill test results, Earthing measurement results...),
-- attached to a specific work item on a specific tower — distinct from `photos` (images)
-- and from `documents` (project-level, not tower-specific).
create table public.asset_documents (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  work_item_key text not null,
  file_name text not null,
  file_url text not null,
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz not null default now()
);

create index on public.asset_documents (asset_id);
create index on public.asset_documents (asset_id, work_item_key);

alter table public.asset_documents enable row level security;

create policy "anyone can view asset documents of published projects"
  on public.asset_documents for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.assets a
      join public.projects p on p.id = a.project_id
      where a.id = asset_documents.asset_id and p.is_public = true and p.is_active = true
    )
  );

create policy "members can view asset documents"
  on public.asset_documents for select
  to authenticated
  using (
    exists (
      select 1 from public.assets a
      where a.id = asset_documents.asset_id
        and public.has_project_role(a.project_id, array['admin', 'field_engineer', 'viewer']::public.user_role[])
    )
  );

create policy "admins and field engineers manage asset documents"
  on public.asset_documents for all
  to authenticated
  using (
    exists (
      select 1 from public.assets a
      where a.id = asset_documents.asset_id
        and public.has_project_role(a.project_id, array['admin', 'field_engineer']::public.user_role[])
    )
  )
  with check (
    exists (
      select 1 from public.assets a
      where a.id = asset_documents.asset_id
        and public.has_project_role(a.project_id, array['admin', 'field_engineer']::public.user_role[])
    )
  );
