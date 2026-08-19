-- Adds the 'tower_weights' project_config key for Jvari-Tskaltubo: per-tower-type steel
-- erection weight, extracted from "500kV Weights.xlsm" (sheet 500kV-SC).
-- Total tower weight (kg) = bodyExtensions[bodyExtM] + legAdjustments[legExtM].
-- bodyExtM comes straight from the asset_type suffix (e.g. "BNS+9" -> bodyExtM = 9, per
-- user instruction); legExtM is fixed at 0 for now (leg extensions not yet tracked
-- per-tower). stubWeightKg is the separate stub/angle weight (Foundation-phase "Stub
-- Setting" item), not part of the erection weight sum -- kept for future reference.
-- Null entries mean that specific body/leg configuration has no data in the source file.
-- B90C has its own real data here (unlike foundation_types, where it aliases to B90) --
-- but its bodyExtensions table is mostly empty; only "-6" has a value, so the two live
-- B90C towers (bare "B90C", bodyExtM=0) currently have no computable total weight.
insert into public.project_config (project_id, key, value)
values (
  (select id from public.projects where slug = 'jvari-tskaltubo'),
  'tower_weights',
  '[
    {
      "type": "BNS",
      "stubWeightKg": 498,
      "bodyExtensions": {"-6": 10500, "-3": 11421.0, "0": 12777.5, "3": 13497.3, "6": 15123.5, "9": 16059.5, "12": 18092.5},
      "legAdjustments": {"-3": 137.6, "-1.5": 260.0, "0": 362.6, "1.5": 509.4, "3": 600.1, "4.5": 723.8, "6": null}
    },
    {
      "type": "BLC",
      "stubWeightKg": 757,
      "bodyExtensions": {"-6": 13694.0, "0": 17577.7, "6": 20847.4, "12": 25195.3, "18": 30335.3},
      "legAdjustments": {"-4.5": null, "-3": 456.4, "-1.5": 590.9, "0": 733.6, "1.5": 890.9, "3": 1068.5, "4.5": 1212.7, "6": null, "7.5": null}
    },
    {
      "type": "B30",
      "stubWeightKg": 1088,
      "bodyExtensions": {"-6": 16140, "-3": 16538.1, "0": 18664.5, "3": 20958.8, "6": 22347.3, "9": 25217.9, "12": 26845.0},
      "legAdjustments": {"-3": 342.9, "-1.5": 464.8, "0": 644.6, "1.5": 806.5, "3": 968.1, "4.5": 1191.7, "6": null}
    },
    {
      "type": "B60",
      "stubWeightKg": 1792,
      "bodyExtensions": {"-6": null, "-3": 20580.8, "0": 23827.3, "3": 25647.6, "6": 28795.7, "9": 30877.8, "12": 35339.7},
      "legAdjustments": {"-3": 465.7, "-1.5": 639.1, "0": 869.3, "1.5": 1088.0, "3": 1315.7, "4.5": 1611.0, "6": null}
    },
    {
      "type": "B90",
      "stubWeightKg": 1924,
      "bodyExtensions": {"-6": null, "-3": 24570, "0": 26586.9, "3": 30378.3, "6": 33388.9, "9": 35851.0, "12": 37757.6},
      "legAdjustments": {"-3": 666.1, "-1.5": 851.0, "0": 1120.7, "1.5": 1384.2, "3": 1636.4, "4.5": 1974.0, "6": null}
    },
    {
      "type": "B90C",
      "stubWeightKg": 1583,
      "bodyExtensions": {"-6": 19275, "-3": null, "0": null, "3": null, "6": null, "9": null},
      "legAdjustments": {"-3": null, "-1.5": 750.5, "0": 1018.2, "1.5": 1231.1, "3": null, "4.5": null}
    },
    {
      "type": "BLS",
      "stubWeightKg": 2200,
      "bodyExtensions": {"-6": 38674.9, "0": 49517.4, "6": 57325.3, "12": 68325.3, "18": 75527.1},
      "legAdjustments": {"-4.5": null, "-3": 1450.7, "-1.5": 1781.1, "0": 2230.9, "1.5": 2622.8, "3": 3177.4, "4.5": 3594.0, "6": null}
    }
  ]'
)
on conflict (project_id, key) do update set value = excluded.value;
