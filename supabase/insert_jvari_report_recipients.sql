-- Seeds the daily-report recipient list -- just the account owner for now, editable
-- from the app's new "Report settings" admin page from here on.
insert into public.project_config (project_id, key, value)
values (
  (select id from public.projects where slug = 'jvari-tskaltubo'),
  'report_recipients',
  '["onselim@gmail.com"]'
)
on conflict (project_id, key) do update set value = excluded.value;
