-- Restriction reason, shown only when a tower's site_access_status is 'restricted'.
alter table public.asset_daily_log add column restriction_reason text;
