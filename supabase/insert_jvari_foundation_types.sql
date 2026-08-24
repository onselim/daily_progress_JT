-- Adds the 'foundation_types' project_config key for Jvari-Tskaltubo: per-tower-type
-- Good Soil (Class 3 / C-3) foundation quantities, extracted from the 6 uploaded
-- Foundation Drawings PDFs (BNS, B30, B60, B90, BLC, BLS), all Suspension-type towers.
-- leanConcreteM3 = bWidthM^2 * 4 * 0.10, cross-checked against each PDF's own
-- "QUANTITY FOR ONE LEG" Lean Concrete value x4 -- matched almost exactly for all 6.
-- B90C has no separate drawing; the app resolves it to the B90 entry (user instruction).
-- soilTypeCode is the numeric soil-class code (matches assets.soil_type) that the
-- Foundation section's "Soil Type" picker matches against -- only 3 (Good Soil) is
-- uploaded so far, so the picker just shows one option per type until more are added.
insert into public.project_config (project_id, key, value)
values (
  (select id from public.projects where slug = 'jvari-tskaltubo'),
  'foundation_types',
  '[
    {"type": "BNS", "soilType": "Good Soil", "soilTypeCode": 3, "bWidthM": 2.55, "concreteM3": 14.15, "excavationM3": 83.2, "reinforcementKg": 1313, "leanConcreteM3": 2.60},
    {"type": "B30", "soilType": "Good Soil", "soilTypeCode": 3, "bWidthM": 3.45, "concreteM3": 27.48, "excavationM3": 161.9, "reinforcementKg": 2171, "leanConcreteM3": 4.76},
    {"type": "B60", "soilType": "Good Soil", "soilTypeCode": 3, "bWidthM": 4.00, "concreteM3": 39.06, "excavationM3": 256.0, "reinforcementKg": 4342, "leanConcreteM3": 6.40},
    {"type": "B90", "soilType": "Good Soil", "soilTypeCode": 3, "bWidthM": 4.10, "concreteM3": 40.35, "excavationM3": 269.0, "reinforcementKg": 4681, "leanConcreteM3": 6.72},
    {"type": "BLC", "soilType": "Good Soil", "soilTypeCode": 3, "bWidthM": 2.65, "concreteM3": 16.66, "excavationM3": 95.5, "reinforcementKg": 1517, "leanConcreteM3": 2.81},
    {"type": "BLS", "soilType": "Good Soil", "soilTypeCode": 3, "bWidthM": 5.00, "concreteM3": 72.48, "excavationM3": 450.0, "reinforcementKg": 8184, "leanConcreteM3": 10.00}
  ]'
)
on conflict (project_id, key) do update set value = excluded.value;
