-- Lets an existing project admin create new projects from the app (the
-- "New Project" wizard), instead of every project being hand-inserted via
-- the SQL Editor. The creator is auto-granted admin on the project they
-- just made, via a trigger that runs inside the same transaction as the
-- insert -- so by the time the client's next request arrives (saving
-- project_config), has_project_role() already sees the row and normal RLS
-- just works, with no chicken-and-egg special-casing anywhere else.

alter table public.projects add column if not exists created_by uuid references auth.users(id);

create policy "existing admins can create projects"
  on public.projects for insert
  to authenticated
  with check (
    exists (
      select 1 from public.user_project_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

create or replace function public.handle_new_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is not null then
    insert into public.user_project_roles (user_id, project_id, role)
    values (new.created_by, new.id, 'admin')
    on conflict (user_id, project_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_project_created
  after insert on public.projects
  for each row execute function public.handle_new_project();
