-- Lets a project admin look up the email (via `profiles`) of anyone who holds a role
-- on a project they administer -- needed for the new admin "Team" page's member list.
-- `profiles` previously only let a user read their own row.
create policy "admins can view profiles of their project members"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1 from public.user_project_roles upr
      where upr.user_id = profiles.id
        and public.has_project_role(upr.project_id, array['admin']::public.user_role[])
    )
  );
