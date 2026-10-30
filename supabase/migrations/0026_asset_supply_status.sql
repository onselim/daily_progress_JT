-- Per-tower material (supply) status: WHICH towers' steel / stubs have been ordered, manufactured, shipped or delivered,
-- instead of only a project-wide percentage. The project-level Supply % is computed from these rows (weighted by tower weight)
-- once any tower has a status; until then the manual percentages in project_work_items stay in charge.
--
-- component: 'tower' = tower steel (body + legs), 'stub' = stub / cleat set of that tower.
-- 'erected' is NOT stored here: it comes from the Construction work item (er_te) of the same tower.
create table public.asset_supply_status (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  component text not null check (component in ('tower', 'stub')),
  stage text not null default 'not_ordered'
    check (stage in ('not_ordered', 'ordered', 'manufacturing', 'manufactured', 'shipped', 'delivered')),
  note text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (asset_id, component)
);

create trigger set_updated_at
  before update on public.asset_supply_status
  for each row execute function public.set_updated_at();

create index on public.asset_supply_status (asset_id);

alter table public.asset_supply_status enable row level security;

create policy "anyone can view supply status of published projects"
  on public.asset_supply_status for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.assets a
      join public.projects p on p.id = a.project_id
      where a.id = asset_supply_status.asset_id and p.is_public = true and p.is_active = true
    )
  );

create policy "members can view supply status"
  on public.asset_supply_status for select
  to authenticated
  using (
    exists (
      select 1 from public.assets a
      where a.id = asset_supply_status.asset_id
        and public.has_project_role(a.project_id, array['admin', 'field_engineer', 'viewer']::public.user_role[])
    )
  );

create policy "admins and field engineers manage supply status"
  on public.asset_supply_status for all
  to authenticated
  using (
    exists (
      select 1 from public.assets a
      where a.id = asset_supply_status.asset_id
        and public.has_project_role(a.project_id, array['admin', 'field_engineer']::public.user_role[])
    )
  )
  with check (
    exists (
      select 1 from public.assets a
      where a.id = asset_supply_status.asset_id
        and public.has_project_role(a.project_id, array['admin', 'field_engineer']::public.user_role[])
    )
  );
