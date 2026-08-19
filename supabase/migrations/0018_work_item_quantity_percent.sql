-- Foundation work isn't always 100% of the designed quantity even when a step is
-- functionally "done" -- e.g. a pad-and-chimney foundation where only the pad is poured
-- so far, or a tower where only 2 of 4 legs got concreted this visit. quantity_percent
-- captures how much of the item's designed quantity (concrete/excavation/reinforcement
-- volume) was actually placed, independent of the not_started/in_progress/completed
-- status pipeline (which stays driven by percent_complete, unchanged). Defaults to 100 --
-- only entered manually when a step is partial.
alter table public.asset_work_items
  add column quantity_percent numeric(5, 2) not null default 100
    check (quantity_percent between 0 and 100);
