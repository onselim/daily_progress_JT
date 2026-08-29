-- Towers 66-110 are from a project revision that no longer matches tip3_deneme.xlsm's
-- TOWER_LIST (user confirmed 2026-08-23: "67 110 arası proje değişti"). The leg-extension
-- backfill for this range is unreliable -- clear it back to "no data" so the excavation-pit
-- generator skips these towers until corrected per-tower data is provided.
update public.assets
set leg1_ext_m = null, leg2_ext_m = null, leg3_ext_m = null, leg4_ext_m = null, soil_type = 3
where project_id = (select id from public.projects where slug = 'jvari-tskaltubo')
  and asset_code ~ '^[0-9]+$'
  and asset_code::int between 66 and 110;
