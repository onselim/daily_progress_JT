-- Leg extensions are tracked per leg: every tower has four, made (and shipped) separately from the tower body.
-- component 'leg1'..'leg4' = leg A..D, in the same column order as the GTT follow-up list.
alter table public.asset_supply_status drop constraint if exists asset_supply_status_component_check;
alter table public.asset_supply_status
  add constraint asset_supply_status_component_check
  check (component in ('tower', 'stub', 'leg1', 'leg2', 'leg3', 'leg4'));
