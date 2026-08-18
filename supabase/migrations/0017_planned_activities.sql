-- planned_activities: source for the "Plan for Tomorrow" list — a tower + work item
-- paired with a future date, added via the topbar's tower/activity picker. Distinct from
-- asset_work_items (current status) since a plan can exist before any work starts.
create table public.planned_activities (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  work_item_key text not null,
  planned_date date not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index on public.planned_activities (asset_id, planned_date);
create index on public.planned_activities (planned_date);

alter table public.planned_activities enable row level security;

create policy "anyone can view planned activities of published projects"
  on public.planned_activities for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.assets a
      join public.projects p on p.id = a.project_id
      where a.id = planned_activities.asset_id and p.is_public = true and p.is_active = true
    )
  );

create policy "members can view planned activities"
  on public.planned_activities for select
  to authenticated
  using (
    exists (
      select 1 from public.assets a
      where a.id = planned_activities.asset_id
        and public.has_project_role(a.project_id, array['admin', 'field_engineer', 'viewer']::public.user_role[])
    )
  );

create policy "admins and field engineers manage planned activities"
  on public.planned_activities for all
  to authenticated
  using (
    exists (
      select 1 from public.assets a
      where a.id = planned_activities.asset_id
        and public.has_project_role(a.project_id, array['admin', 'field_engineer']::public.user_role[])
    )
  )
  with check (
    exists (
      select 1 from public.assets a
      where a.id = planned_activities.asset_id
        and public.has_project_role(a.project_id, array['admin', 'field_engineer']::public.user_role[])
    )
  );
