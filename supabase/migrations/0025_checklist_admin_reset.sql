-- Admin tools for checklists: reopen (reset) an approval stage, e.g. after a wrong or test approval.
-- Deleting a whole checklist needs no new database code: the admin delete policy from 0023 already allows it
-- (its approval requests and audit events are removed with it by the foreign keys).
--
-- Approval state (`gates`) may only be changed by the approval workflow. The reset runs inside a SECURITY DEFINER
-- function that checks the caller is an admin of the project and then switches a transaction-local flag that the
-- protection trigger honours; nothing a browser can send sets that flag.

create or replace function public.checklist_protect_gates()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and coalesce(current_setting('app.checklist_workflow', true), '') <> 'on' then
    if tg_op = 'INSERT' then
      new.gates := '{}'::jsonb;
    elsif new.gates is distinct from old.gates then
      raise exception 'Checklist approval state can only be changed by the approval workflow';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.checklist_reset_gate(p_instance_id uuid, p_gate text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project uuid;
begin
  select project_id into v_project from public.checklist_instances where id = p_instance_id;
  if v_project is null then
    raise exception 'Checklist not found';
  end if;
  if not public.has_project_role(v_project, array['admin']::public.user_role[]) then
    raise exception 'Only a project admin can reset an approval stage';
  end if;

  perform set_config('app.checklist_workflow', 'on', true);

  -- Links already e-mailed for this stage stop working.
  update public.checklist_approval_requests
     set status = 'superseded'
   where instance_id = p_instance_id and gate_key = p_gate and status = 'pending';

  update public.checklist_instances
     set gates = jsonb_set(coalesce(gates, '{}'::jsonb), array[p_gate],
                           jsonb_build_object('status', 'draft', 'reset_at', now(), 'reset_by', auth.uid()))
   where id = p_instance_id;

  insert into public.checklist_events (instance_id, user_id, action, detail)
  values (p_instance_id, auth.uid(), 'reset_gate', jsonb_build_object('gate', p_gate));
end;
$$;

revoke execute on function public.checklist_reset_gate(uuid, text) from public, anon;
grant execute on function public.checklist_reset_gate(uuid, text) to authenticated;
