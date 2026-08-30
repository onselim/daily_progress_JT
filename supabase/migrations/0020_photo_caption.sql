-- Optional short note attached at the moment a photo is uploaded (e.g. "leg 3 rebar
-- cage tied"), separate from the tower-level daily notes.
alter table public.photos
  add column caption text;
