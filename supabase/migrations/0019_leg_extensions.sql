-- Per-leg extension (mm-precision, stored in metres) and soil type, needed to compute
-- each leg's excavation footprint. Nullable leg columns: not every project has this
-- data. soil_type defaults to 3 (Good Soil) per current project data.
alter table public.assets
  add column leg1_ext_m numeric,
  add column leg2_ext_m numeric,
  add column leg3_ext_m numeric,
  add column leg4_ext_m numeric,
  add column soil_type integer not null default 3;
