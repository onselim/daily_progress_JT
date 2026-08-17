-- One-off: fix ordering + group dividers for Jvari-Tskaltubo's "Project documents"
-- folders. The 14 default folders already exist (from an earlier run of this script,
-- before sort_order/divider_after existed) but all share sort_order=0 — this assigns
-- them the intended order, starting at 10 so the two folders you created yourself
-- (LineRoute, Hardware_Fittings, left at sort_order=0) sort first, clearly separated.
-- Safe to re-run.
with target as (
  select id as project_id from public.projects where slug = 'jvari-tskaltubo'
),
defaults (name, sort_order, divider_after) as (
  values
    ('Line Route', 10, false),
    ('Line Profile', 11, false),
    ('Structure List', 12, true),
    ('Tower Design', 20, false),
    ('Tower Drawings', 21, false),
    ('Stub Drawings', 22, false),
    ('Foundation Drawings', 23, true),
    ('Conductor Drawings', 30, false),
    ('OPGW Drawings', 31, false),
    ('EW Drawings', 32, true),
    ('Hardware-Insulator Set Drawings', 40, false),
    ('Dampers', 41, true),
    ('Other Line Materials', 50, true),
    ('Sag Tension Charts', 60, false)
)
update public.document_folders df
set sort_order = d.sort_order, divider_after = d.divider_after
from target t, defaults d
where df.project_id = t.project_id
  and df.section = 'documents'
  and df.parent_folder_id is null
  and df.name = d.name;
