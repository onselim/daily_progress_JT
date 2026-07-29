-- Enable RLS everywhere
alter table public.projects enable row level security;
alter table public.project_config enable row level security;
alter table public.profiles enable row level security;
alter table public.user_project_roles enable row level security;
alter table public.assets enable row level security;
alter table public.asset_daily_log enable row level security;
alter table public.asset_work_items enable row level security;
alter table public.documents enable row level security;
alter table public.photos enable row level security;
alter table public.activity_log enable row level security;
alter table public.daily_report_snapshots enable row level security;

-- ============ projects ============
-- Public viewer access: no login, just the link -> only published+active projects are readable.
create policy "anyone can view published projects"
  on public.projects for select
  to anon, authenticated
  using (is_public = true and is_active = true);

-- Members (admin/field_engineer/viewer) can see their own project even if unpublished.
create policy "members can view their projects"
  on public.projects for select
  to authenticated
  using (public.has_project_role(id, array['admin', 'field_engineer', 'viewer']::public.user_role[]));

create policy "admins can update their projects"
  on public.projects for update
  to authenticated
  using (public.has_project_role(id, array['admin']::public.user_role[]))
  with check (public.has_project_role(id, array['admin']::public.user_role[]));

-- Project creation/deletion is done by the service role (internal onboarding), not exposed to clients.

-- ============ project_config ============
create policy "read config with project access"
  on public.project_config for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_config.project_id
        and (
          (p.is_public and p.is_active)
          or public.has_project_role(p.id, array['admin', 'field_engineer', 'viewer']::public.user_role[])
        )
    )
  );

create policy "admins manage config"
  on public.project_config for all
  to authenticated
  using (public.has_project_role(project_id, array['admin']::public.user_role[]))
  with check (public.has_project_role(project_id, array['admin']::public.user_role[]));

-- ============ profiles ============
create policy "users can view own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "users can update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ============ user_project_roles ============
create policy "users can view own role rows"
  on public.user_project_roles for select
  to authenticated
  using (user_id = auth.uid() or public.has_project_role(project_id, array['admin']::public.user_role[]));

create policy "admins manage roles"
  on public.user_project_roles for all
  to authenticated
  using (public.has_project_role(project_id, array['admin']::public.user_role[]))
  with check (public.has_project_role(project_id, array['admin']::public.user_role[]));

-- ============ assets ============
create policy "anyone can view assets of published projects"
  on public.assets for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = assets.project_id and p.is_public = true and p.is_active = true
    )
  );

create policy "members can view assets"
  on public.assets for select
  to authenticated
  using (public.has_project_role(project_id, array['admin', 'field_engineer', 'viewer']::public.user_role[]));

create policy "admins and field engineers manage assets"
  on public.assets for all
  to authenticated
  using (public.has_project_role(project_id, array['admin', 'field_engineer']::public.user_role[]))
  with check (public.has_project_role(project_id, array['admin', 'field_engineer']::public.user_role[]));

-- ============ asset_daily_log ============
create policy "anyone can view daily logs of published projects"
  on public.asset_daily_log for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.assets a
      join public.projects p on p.id = a.project_id
      where a.id = asset_daily_log.asset_id and p.is_public = true and p.is_active = true
    )
  );

create policy "members can view daily logs"
  on public.asset_daily_log for select
  to authenticated
  using (
    exists (
      select 1 from public.assets a
      where a.id = asset_daily_log.asset_id
        and public.has_project_role(a.project_id, array['admin', 'field_engineer', 'viewer']::public.user_role[])
    )
  );

create policy "admins and field engineers manage daily logs"
  on public.asset_daily_log for all
  to authenticated
  using (
    exists (
      select 1 from public.assets a
      where a.id = asset_daily_log.asset_id
        and public.has_project_role(a.project_id, array['admin', 'field_engineer']::public.user_role[])
    )
  )
  with check (
    exists (
      select 1 from public.assets a
      where a.id = asset_daily_log.asset_id
        and public.has_project_role(a.project_id, array['admin', 'field_engineer']::public.user_role[])
    )
  );

-- ============ asset_work_items ============
create policy "anyone can view work items of published projects"
  on public.asset_work_items for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.assets a
      join public.projects p on p.id = a.project_id
      where a.id = asset_work_items.asset_id and p.is_public = true and p.is_active = true
    )
  );

create policy "members can view work items"
  on public.asset_work_items for select
  to authenticated
  using (
    exists (
      select 1 from public.assets a
      where a.id = asset_work_items.asset_id
        and public.has_project_role(a.project_id, array['admin', 'field_engineer', 'viewer']::public.user_role[])
    )
  );

create policy "admins and field engineers manage work items"
  on public.asset_work_items for all
  to authenticated
  using (
    exists (
      select 1 from public.assets a
      where a.id = asset_work_items.asset_id
        and public.has_project_role(a.project_id, array['admin', 'field_engineer']::public.user_role[])
    )
  )
  with check (
    exists (
      select 1 from public.assets a
      where a.id = asset_work_items.asset_id
        and public.has_project_role(a.project_id, array['admin', 'field_engineer']::public.user_role[])
    )
  );

-- ============ documents ============
create policy "anyone can view documents of published projects"
  on public.documents for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = documents.project_id and p.is_public = true and p.is_active = true
    )
  );

create policy "members can view documents"
  on public.documents for select
  to authenticated
  using (public.has_project_role(project_id, array['admin', 'field_engineer', 'viewer']::public.user_role[]));

create policy "admins and field engineers manage documents"
  on public.documents for all
  to authenticated
  using (public.has_project_role(project_id, array['admin', 'field_engineer']::public.user_role[]))
  with check (public.has_project_role(project_id, array['admin', 'field_engineer']::public.user_role[]));

-- ============ photos ============
create policy "anyone can view photos of published projects"
  on public.photos for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = photos.project_id and p.is_public = true and p.is_active = true
    )
  );

create policy "members can view photos"
  on public.photos for select
  to authenticated
  using (public.has_project_role(project_id, array['admin', 'field_engineer', 'viewer']::public.user_role[]));

create policy "admins and field engineers manage photos"
  on public.photos for all
  to authenticated
  using (public.has_project_role(project_id, array['admin', 'field_engineer']::public.user_role[]))
  with check (public.has_project_role(project_id, array['admin', 'field_engineer']::public.user_role[]));

-- ============ activity_log ============
-- Internal audit trail: no anonymous/public access.
create policy "admins view activity log"
  on public.activity_log for select
  to authenticated
  using (public.has_project_role(project_id, array['admin']::public.user_role[]));

create policy "admins and field engineers write activity log"
  on public.activity_log for insert
  to authenticated
  with check (public.has_project_role(project_id, array['admin', 'field_engineer']::public.user_role[]));

-- ============ daily_report_snapshots ============
create policy "anyone can view report snapshots of published projects"
  on public.daily_report_snapshots for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = daily_report_snapshots.project_id and p.is_public = true and p.is_active = true
    )
  );

create policy "members can view report snapshots"
  on public.daily_report_snapshots for select
  to authenticated
  using (public.has_project_role(project_id, array['admin', 'field_engineer', 'viewer']::public.user_role[]));

create policy "admins manage report snapshots"
  on public.daily_report_snapshots for all
  to authenticated
  using (public.has_project_role(project_id, array['admin']::public.user_role[]))
  with check (public.has_project_role(project_id, array['admin']::public.user_role[]));
