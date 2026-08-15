-- project_work_items: project-wide (non-per-tower) progress for Design and
-- Supply items. Mirrors asset_work_items but keyed on project_id directly,
-- since Design and Supply are tracked once per project, not per tower
-- (see project_config keys 'design_items' / 'supply_items' for the item
-- definitions -- key/label/weight -- this table holds the live status).
create table public.project_work_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  category text not null check (category in ('design', 'supply')),
  work_item_key text not null,
  percent_complete numeric(5, 2) not null default 0 check (percent_complete between 0 and 100),
  status text not null default 'not_started',
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (project_id, category, work_item_key)
);

create trigger set_updated_at
  before update on public.project_work_items
  for each row execute function public.set_updated_at();

create index on public.project_work_items (project_id, category);

alter table public.project_work_items enable row level security;

create policy "anyone can view project work items of published projects"
  on public.project_work_items for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_work_items.project_id and p.is_public = true and p.is_active = true
    )
  );

create policy "members can view project work items"
  on public.project_work_items for select
  to authenticated
  using (public.has_project_role(project_id, array['admin', 'field_engineer', 'viewer']::public.user_role[]));

create policy "admins and field engineers manage project work items"
  on public.project_work_items for all
  to authenticated
  using (public.has_project_role(project_id, array['admin', 'field_engineer']::public.user_role[]))
  with check (public.has_project_role(project_id, array['admin', 'field_engineer']::public.user_role[]));
