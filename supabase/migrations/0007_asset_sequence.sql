-- Display-order column: the physical station/chainage is not monotonic
-- across an entire line when a project has parallel/branch sections with
-- their own chainage series, so it can't be used to order the sidebar
-- list or the map polyline. This column holds the source file's original
-- row order instead, which is the reliable sort key.
alter table public.assets add column if not exists sequence integer;
