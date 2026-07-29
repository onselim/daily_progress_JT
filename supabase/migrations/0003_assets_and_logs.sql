-- Enums
create type public.asset_status as enum ('not_started', 'in_progress', 'completed', 'on_hold');
create type public.work_item_status as enum ('not_started', 'in_progress', 'completed');

-- assets: generic "tower" abstraction (also weld joint, chainage segment, ...)
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  asset_code text not null,
  asset_type text,
  x double precision,
  y double precision,
  z double precision,
  station text,
  status public.asset_status not null default 'not_started',
  lat double precision,
  lng double precision,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, asset_code)
);

create trigger set_updated_at
  before update on public.assets
  for each row execute function public.set_updated_at();

create index on public.assets (project_id);

-- asset_daily_log: source for "today's progress / plan for tomorrow"
create table public.asset_daily_log (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  log_date date not null,
  completed_today text,
  planned_tomorrow text,
  site_access_status text not null default 'normal',
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (asset_id, log_date)
);

create index on public.asset_daily_log (asset_id, log_date desc);

-- asset_work_items: per-work-item completion, feeds the Construction% formula
create table public.asset_work_items (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  work_item_key text not null,
  percent_complete numeric(5, 2) not null default 0 check (percent_complete between 0 and 100),
  status public.work_item_status not null default 'not_started',
  completed_at timestamptz,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (asset_id, work_item_key)
);

create trigger set_updated_at
  before update on public.asset_work_items
  for each row execute function public.set_updated_at();

create index on public.asset_work_items (asset_id);
