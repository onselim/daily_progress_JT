-- Sub-folders: a folder can now live inside another folder (arbitrary depth).
alter table public.document_folders
  add column parent_folder_id uuid references public.document_folders(id) on delete cascade;

create index on public.document_folders (parent_folder_id);

-- Deterministic ordering + a visual "row gap" between groups of default folders —
-- bulk-inserted default folders all share the same `created_at` (one statement, one
-- transaction timestamp), so sorting by insert time alone doesn't reproduce the intended
-- order.
alter table public.document_folders add column sort_order integer not null default 0;
alter table public.document_folders add column divider_after boolean not null default false;
