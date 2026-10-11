-- Who receives checklist approval requests for Jvari-Tskaltubo. TEST SETUP: the account owner is both
-- "Consultant" and "Employer" so the whole flow (including "both parties approved") can be tried with one mailbox.
-- Replace these addresses with the real Consultant / Employer contacts when going live
-- (several addresses per party are allowed; any ONE person of a party can approve for that party).
insert into public.project_config (project_id, key, value)
values (
  (select id from public.projects where slug = 'jvari-tskaltubo'),
  'checklist_recipients',
  '{"consultant": ["onselim@gmail.com"], "employer": ["onselim@gmail.com"]}'
)
on conflict (project_id, key) do update set value = excluded.value;
