-- "section" lets the same folder+document CRUD power more than one accordion panel
-- (Project documents vs. the Layers tab) without mixing their contents together.
alter table public.document_folders add column section text not null default 'documents';
alter table public.documents add column section text not null default 'documents';
