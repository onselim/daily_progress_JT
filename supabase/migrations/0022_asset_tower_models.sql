-- Per-asset 3D tower wireframe, extracted (client-side, admin-triggered) from a
-- PLS-CADD KMZ/KML uploaded to the "Layers" documents section. Segments are stored in
-- each tower's own local East-North-Up frame (meters, relative to its own base) rather
-- than absolute coordinates, so the 3D view can reorient them (lying vs standing) based
-- on that asset's Ground Assembly / Erection of Towers work-item status.
create table public.asset_tower_models (
  asset_id uuid primary key references public.assets(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  segments jsonb not null,
  source_layer_id text,
  extracted_at timestamptz not null default now()
);

create index on public.asset_tower_models (project_id);

alter table public.asset_tower_models enable row level security;

create policy "anyone can view tower models of published projects"
  on public.asset_tower_models for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = asset_tower_models.project_id and p.is_public = true and p.is_active = true
    )
  );

create policy "members can view tower models"
  on public.asset_tower_models for select
  to authenticated
  using (public.has_project_role(project_id, array['admin', 'field_engineer', 'viewer']::public.user_role[]));

create policy "admins and field engineers manage tower models"
  on public.asset_tower_models for all
  to authenticated
  using (public.has_project_role(project_id, array['admin', 'field_engineer']::public.user_role[]))
  with check (public.has_project_role(project_id, array['admin', 'field_engineer']::public.user_role[]));
