-- 1) Tower 111 (missing from the project so far): B30+3, UTM 38N 283266.01 E / 4712395.52 N.
--    Leg extensions as given (leg1..leg4 = -3, +3, +1.5, -3). Elevation (z) is not known yet -> left empty.
--    Station: Part-3 chainage series, 112 is at 38285 and 111 is 213.5 m before it (straight-line distance) -> about 38071.
insert into public.assets (project_id, asset_code, asset_type, x, y, station, status, leg1_ext_m, leg2_ext_m, leg3_ext_m, leg4_ext_m)
select p.id, '111', 'B30+3', 283266.01, 4712395.52, '38071', 'not_started', -3, 3, 1.5, -3
from public.projects p
where p.slug = 'jvari-tskaltubo'
on conflict (project_id, asset_code) do update
  set asset_type = excluded.asset_type, x = excluded.x, y = excluded.y, station = excluded.station,
      leg1_ext_m = excluded.leg1_ext_m, leg2_ext_m = excluded.leg2_ext_m, leg3_ext_m = excluded.leg3_ext_m, leg4_ext_m = excluded.leg4_ext_m;

-- 2) Part-3 towers that have no colour in the GTT follow-up list were entered as "Ordered" by mistake.
--    They are not ordered: set them (and tower 111, which has no colour either) back to "Not ordered".
insert into public.asset_supply_status (asset_id, component, stage)
select a.id, 'tower', 'not_ordered'
from public.assets a
join public.projects p on p.id = a.project_id and p.slug = 'jvari-tskaltubo'
where a.asset_code = '111'
on conflict (asset_id, component) do update set stage = excluded.stage;

update public.asset_supply_status s
set stage = 'not_ordered'
from public.assets a
join public.projects p on p.id = a.project_id and p.slug = 'jvari-tskaltubo'
where s.asset_id = a.id
  and s.component = 'tower'
  and s.stage = 'ordered';
