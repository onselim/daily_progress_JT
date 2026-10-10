-- Site quality checklists (foundation works first; erection / stringing / OPGW use the same tables).
--
-- A checklist TEMPLATE (sections, fields, labels in 9 languages) lives in the app code, versioned by
-- `template_version`, so adding a new checklist type needs no migration. This migration stores the
-- filled-in INSTANCES: one per tower (asset) per template.
--
-- `data`  = every field the engineer typed (jsonb, keyed by the template's field keys).
-- `gates` = acceptance gates of the template (foundation: class / concreting / backfill), e.g.
--           {"class": {"status": "submitted", "submitted_at": "...", "approvals": {"consultant": {...}, "employer": {...}}}}
--           A gate is approved only when BOTH Consultant and Employer have approved (phase 2 fills `approvals`).
--           The overall checklist is "Approved" once every gate of the template is approved.

create table public.checklist_instances (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  template_key text not null,
  template_version integer not null default 1,
  doc_no text,
  rev text,
  data jsonb not null default '{}'::jsonb,
  gates jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (asset_id, template_key)
);

create trigger set_updated_at
  before update on public.checklist_instances
  for each row execute function public.set_updated_at();

create index on public.checklist_instances (project_id, template_key);

-- Audit trail: who saved / submitted / (later) approved or commented, and when.
create table public.checklist_events (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.checklist_instances(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index on public.checklist_events (instance_id, created_at);

alter table public.checklist_instances enable row level security;
alter table public.checklist_events enable row level security;

-- Project admins and field engineers can read, create and edit the checklists of their project.
create policy "members read checklists"
  on public.checklist_instances for select
  to authenticated
  using (public.has_project_role(project_id, array['admin', 'field_engineer']::public.user_role[]));

create policy "members create checklists"
  on public.checklist_instances for insert
  to authenticated
  with check (public.has_project_role(project_id, array['admin', 'field_engineer']::public.user_role[]));

create policy "members edit checklists"
  on public.checklist_instances for update
  to authenticated
  using (public.has_project_role(project_id, array['admin', 'field_engineer']::public.user_role[]))
  with check (public.has_project_role(project_id, array['admin', 'field_engineer']::public.user_role[]));

create policy "admins delete checklists"
  on public.checklist_instances for delete
  to authenticated
  using (public.has_project_role(project_id, array['admin']::public.user_role[]));

create policy "members read checklist events"
  on public.checklist_events for select
  to authenticated
  using (
    exists (
      select 1 from public.checklist_instances ci
      where ci.id = checklist_events.instance_id
        and public.has_project_role(ci.project_id, array['admin', 'field_engineer']::public.user_role[])
    )
  );

create policy "members add checklist events"
  on public.checklist_events for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.checklist_instances ci
      where ci.id = checklist_events.instance_id
        and public.has_project_role(ci.project_id, array['admin', 'field_engineer']::public.user_role[])
    )
  );
