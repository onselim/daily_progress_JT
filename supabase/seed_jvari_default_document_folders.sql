-- One-off: back-fill the default "Project documents" folders for the Jvari-Tskaltubo
-- project, which was created before default folders existed. Safe to re-run (skips
-- names that already exist for this project+section).
insert into public.document_folders (project_id, name, section)
select p.id, f.name, 'documents'
from public.projects p
cross join (values
  ('Line Route'),
  ('Line Profile'),
  ('Structure List'),
  ('Tower Design'),
  ('Tower Drawings'),
  ('Stub Drawings'),
  ('Foundation Drawings'),
  ('Conductor Drawings'),
  ('OPGW Drawings'),
  ('EW Drawings'),
  ('Hardware-Insulator Set Drawings'),
  ('Dampers'),
  ('Other Line Materials'),
  ('Sag Tension Charts')
) as f(name)
where p.slug = 'jvari-tskaltubo'
  and not exists (
    select 1 from public.document_folders df
    where df.project_id = p.id and df.section = 'documents' and df.name = f.name
  );
