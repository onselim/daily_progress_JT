-- Jvari-Tskaltubo: switch on the foundation checklist module and move the test recipients into the new
-- distribution lists (Admin -> Modules & lists edits them from here on; the old `checklist_recipients` key is only a fallback).
-- Run this BEFORE the new app version is deployed, so the Checklists box never disappears.
insert into public.project_config (project_id, key, value)
values (
  (select id from public.projects where slug = 'jvari-tskaltubo'),
  'enabled_modules',
  '{"checklist.foundation": true}'
)
on conflict (project_id, key) do update set value = excluded.value;

insert into public.project_config (project_id, key, value)
values (
  (select id from public.projects where slug = 'jvari-tskaltubo'),
  'distribution_lists',
  '{"default": {"consultant": [{"name": "Test Consultant", "email": "onselim@gmail.com"}], "employer": [{"name": "Test Employer", "email": "onselim@gmail.com"}], "info": []}, "byType": {}}'
)
on conflict (project_id, key) do update set value = excluded.value;
