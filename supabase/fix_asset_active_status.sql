-- Reconciles assets.status ("Active" badge) with the real progress in asset_work_items,
-- restricted to the 16 keys the current work_items config actually uses (there's a stale
-- 'si_ft' key left over from an old template, 100% on 199/201 towers, which isn't shown
-- anywhere in the UI but would corrupt this comparison if included).
-- Rule: no item above 0% -> not_started; all 16 items at 100% -> completed; otherwise
-- in_progress. Only touches the 9 towers where this disagrees with the stored status.
update public.assets set status = 'not_started'
where project_id = (select id from public.projects where slug = 'jvari-tskaltubo')
  and asset_code in ('1', '4', '15');

update public.assets set status = 'in_progress'
where project_id = (select id from public.projects where slug = 'jvari-tskaltubo')
  and asset_code in ('5', '6', '8', '9', '10', '17');
