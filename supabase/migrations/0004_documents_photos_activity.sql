-- documents: project-level files in user-defined slots (e.g. "Structure List")
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  slot_name text not null,
  file_url text not null,
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz not null default now()
);

create index on public.documents (project_id);

-- photos: asset-linked (or project-level) site photos
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  asset_id uuid references public.assets(id) on delete set null,
  category text,
  file_url text not null,
  gps_lat double precision,
  gps_lng double precision,
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz not null default now()
);

create index on public.photos (project_id);
create index on public.photos (asset_id);

-- activity_log: audit trail for every CSV import / photo upload / edit
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid references auth.users(id),
  action_type text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

create index on public.activity_log (project_id, created_at desc);

-- daily_report_snapshots: end-of-day archived PDF
create table public.daily_report_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  report_date date not null,
  pdf_url text,
  generated_at timestamptz not null default now(),
  unique (project_id, report_date)
);

create index on public.daily_report_snapshots (project_id, report_date desc);
