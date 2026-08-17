-- One-off: back-fill the default "Project documents" folders for the Jvari-Tskaltubo
-- project (and fix their order — bulk-inserted rows share one `created_at`, so ordering
-- by insert time alone doesn't reproduce the intended order). Safe to re-run.
with target as (
  select id as project_id from public.projects where slug = 'jvari-tskaltubo'
),
defaults (name, sort_order, divider_after) as (
  values
    ('Line Route', 0, false),
    ('Line Profile', 1, false),
    ('Structure List', 2, true),
    ('Tower Design', 3, false),
    ('Tower Drawings', 4, false),
    ('Stub Drawings', 5, false),
    ('Foundation Drawings', 6, false),
    ('Conductor Drawings', 7, false),
    ('OPGW Drawings', 8, false),
    ('EW Drawings', 9, false),
    ('Hardware-Insulator Set Drawings', 10, false),
    ('Dampers', 11, false),
    ('Other Line Materials', 12, false),
    ('Sag Tension Charts', 13, false)
)
update public.document_folders df
set sort_order = d.sort_order, divider_after = d.divider_after
from target t, defaults d
where df.project_id = t.project_id
  and df.section = 'documents'
  and df.parent_folder_id is null
  and df.name = d.name;

insert into public.document_folders (project_id, name, section, sort_order, divider_after)
select t.project_id, d.name, 'documents', d.sort_order, d.divider_after
from target t
cross join (
  values
    ('Line Route', 0, false),
    ('Line Profile', 1, false),
    ('Structure List', 2, true),
    ('Tower Design', 3, false),
    ('Tower Drawings', 4, false),
    ('Stub Drawings', 5, false),
    ('Foundation Drawings', 6, false),
    ('Conductor Drawings', 7, false),
    ('OPGW Drawings', 8, false),
    ('EW Drawings', 9, false),
    ('Hardware-Insulator Set Drawings', 10, false),
    ('Dampers', 11, false),
    ('Other Line Materials', 12, false),
    ('Sag Tension Charts', 13, false)
) as d(name, sort_order, divider_after)
where not exists (
  select 1 from public.document_folders df
  where df.project_id = t.project_id
    and df.section = 'documents'
    and df.parent_folder_id is null
    and df.name = d.name
);
