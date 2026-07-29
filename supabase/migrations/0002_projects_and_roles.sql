-- Enums
create type public.user_role as enum ('admin', 'field_engineer', 'viewer');
create type public.industry_type as enum ('transmission_line', 'pipeline', 'road', 'rail');

-- projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  client text,
  contractor text,
  contract_no text,
  industry_type public.industry_type not null default 'transmission_line',
  logo_url text,
  utm_zone text,
  coordinate_system text,
  is_public boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- project_config: sector-specific parameters (work_items, supply_items, asset_label, voltage, ...)
create table public.project_config (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  key text not null,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, key)
);

create trigger set_updated_at
  before update on public.project_config
  for each row execute function public.set_updated_at();

create index on public.project_config (project_id);

-- profiles: mirrors auth.users for display purposes
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);

-- user_project_roles: per-project role assignment (admin / field_engineer / viewer)
create table public.user_project_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  role public.user_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, project_id)
);

create index on public.user_project_roles (project_id);

-- Role-check helper used throughout RLS policies (security definer to avoid recursive RLS)
create or replace function public.has_project_role(p_project_id uuid, p_roles public.user_role[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.user_project_roles upr
    where upr.project_id = p_project_id
      and upr.user_id = auth.uid()
      and upr.role = any(p_roles)
  );
$$;
