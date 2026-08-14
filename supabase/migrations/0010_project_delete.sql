-- Deleting a project was deliberately left unavailable to clients when the
-- schema was first built ("Project creation/deletion is done by the
-- service role"). The user now wants a real, guarded delete flow from the
-- admin UI (confirm-by-typing-the-name, same pattern GitHub uses for repo
-- deletion) since a project is high-value data. This adds the missing
-- piece: an admin of a project can delete it, cascading to every related
-- row (assets, project_config, photos, documents, logs, activity_log,
-- daily_report_snapshots, user_project_roles) via the existing
-- `on delete cascade` foreign keys.
create policy "admins can delete their projects"
  on public.projects for delete
  to authenticated
  using (public.has_project_role(id, array['admin']::public.user_role[]));
