-- Updates work_items config to the fuller grouped taxonomy found in the
-- reference prototype (Daily_Progress_Report_2026-04-04_4.html GROUPS array).
-- Existing per-asset percentages for keys that already existed (ar, si_sw,
-- fn_ex, fn_lc, fn_ss, fn_co, fn_bf, er_ge, er_te, st_cd, st_ew) are kept —
-- only the config list changes, not the saved asset_work_items rows.
-- Weights for si_ft, fn_rf, fn_fw, st_op are NOT sourced from a verified
-- Excel table (unavailable) — these are placeholder guesses, flagged here
-- for follow-up.
update public.project_config
set value = '[
  {"group": "Access Road", "key": "ar", "label": "Access Road", "weight": 4},
  {"group": "Soil Investigation", "key": "si_sw", "label": "Site Work", "weight": 3},
  {"group": "Soil Investigation", "key": "si_ft", "label": "Foundation Type", "weight": 2},
  {"group": "Foundation", "key": "fn_ex", "label": "Excavation", "weight": 5},
  {"group": "Foundation", "key": "fn_lc", "label": "Lean Concrete", "weight": 1},
  {"group": "Foundation", "key": "fn_ss", "label": "Stub Setting", "weight": 2},
  {"group": "Foundation", "key": "fn_rf", "label": "Reinforcement", "weight": 3},
  {"group": "Foundation", "key": "fn_fw", "label": "Formwork", "weight": 2},
  {"group": "Foundation", "key": "fn_co", "label": "Concrete", "weight": 15},
  {"group": "Foundation", "key": "fn_bf", "label": "Backfilling", "weight": 2},
  {"group": "Erection", "key": "er_ge", "label": "Ground Erection", "weight": 4},
  {"group": "Erection", "key": "er_te", "label": "Tower Erection", "weight": 5},
  {"group": "Stringing", "key": "st_cd", "label": "Conductor", "weight": 10},
  {"group": "Stringing", "key": "st_op", "label": "OPGW", "weight": 4},
  {"group": "Stringing", "key": "st_ew", "label": "EW", "weight": 4}
]'
where key = 'work_items'
  and project_id = (select id from public.projects where slug = 'jvari-tskaltubo');
