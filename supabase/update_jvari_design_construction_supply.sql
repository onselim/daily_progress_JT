-- Run this once in the Supabase SQL Editor to bring the live
-- Jvari-Tskaltubo project onto the new Design/Construction/Supply
-- weight tables (sourced from "rapor yüzdeler.xlsx").
--
-- This only replaces the *config* (project_config.work_items /
-- supply_items, plus a new design_items row) -- it does not touch any
-- already-recorded asset_work_items progress. Two old, no-longer-used
-- Construction keys (si_ft "Foundation Type") are dropped from the
-- config; any historical data recorded under them is left in place,
-- just no longer read by the app.

do $$
declare
  v_project_id uuid;
begin
  select id into v_project_id from public.projects where slug = 'jvari-tskaltubo';

  update public.project_config
  set value = '[
    {"group": "PRE-CONSTRUCTION WORKS", "key": "ar",    "label": "Access Road",                       "weight": 8},
    {"group": "PRE-CONSTRUCTION WORKS", "key": "pc_tc", "label": "Tree Cutting",                       "weight": 5},
    {"group": "PRE-CONSTRUCTION WORKS", "key": "si_sw", "label": "Soil Investigation",                 "weight": 4},
    {"group": "FOUNDATION",             "key": "fn_ex", "label": "Excavation",                         "weight": 8},
    {"group": "FOUNDATION",             "key": "fn_lc", "label": "Lean Concrete",                      "weight": 2},
    {"group": "FOUNDATION",             "key": "fn_ss", "label": "Stub Settings",                      "weight": 3},
    {"group": "FOUNDATION",             "key": "fn_rf", "label": "Reinforcement",                      "weight": 4},
    {"group": "FOUNDATION",             "key": "fn_fw", "label": "Formwork",                            "weight": 4},
    {"group": "FOUNDATION",             "key": "fn_co", "label": "Concreting",                         "weight": 26},
    {"group": "FOUNDATION",             "key": "fn_bf", "label": "Backfilling",                        "weight": 4},
    {"group": "ERECTION",               "key": "er_ge", "label": "Ground Assembly",                    "weight": 8},
    {"group": "ERECTION",               "key": "er_te", "label": "Erection of Towers",                 "weight": 8},
    {"group": "STRINGING",              "key": "st_cd", "label": "Stringing of Conductor",              "weight": 10},
    {"group": "STRINGING",              "key": "st_sg", "label": "Sagging + Conductor Accessories",     "weight": 2},
    {"group": "STRINGING",              "key": "st_op", "label": "Stringing of OPGW",                  "weight": 2},
    {"group": "STRINGING",              "key": "st_ew", "label": "Stringing of EW",                    "weight": 2}
  ]'
  where project_id = v_project_id and key = 'work_items';

  update public.project_config
  set value = '[
    {"key": "stubs",              "label": "Stubs",                 "weight": 7.5},
    {"key": "earthing",           "label": "Earthing",              "weight": 2.5},
    {"key": "towers",             "label": "Towers",                "weight": 32},
    {"key": "conductor",          "label": "Conductor (route km)",  "weight": 30},
    {"key": "ew",                 "label": "EW (route km)",         "weight": 5},
    {"key": "opgw",               "label": "OPGW (route km)",       "weight": 5},
    {"key": "insulators",         "label": "Insulators (route km)", "weight": 6},
    {"key": "hardware",           "label": "Hardware (route km)",   "weight": 7},
    {"key": "dampers",            "label": "Dampers (route km)",    "weight": 4},
    {"key": "other_accessories",  "label": "Other Accessories",     "weight": 1}
  ]'
  where project_id = v_project_id and key = 'supply_items';

  insert into public.project_config (project_id, key, value)
  values (
    v_project_id,
    'design_items',
    '[
      {"key": "line_route",   "label": "Line Route",   "weight": 50},
      {"key": "line_profile", "label": "Line Profile", "weight": 50}
    ]'
  )
  on conflict (project_id, key) do update set value = excluded.value;
end $$;
