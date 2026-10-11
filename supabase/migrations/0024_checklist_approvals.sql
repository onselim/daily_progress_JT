-- Approval workflow for checklists: a field engineer submits a stage (gate), the system e-mails the Consultant and
-- Employer contacts of the project, and each of them approves or comments through a personal link (no login).
--
-- One row per (instance, gate, recipient e-mail). The secret in the link is never stored, only its SHA-256 hash.
-- Rows are written and decided exclusively by the Edge Functions `checklist-notify` / `checklist-review`
-- (service role); the app only reads them.

create table public.checklist_approval_requests (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.checklist_instances(id) on delete cascade,
  gate_key text not null,
  party text not null check (party in ('consultant', 'employer')),
  email text not null,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'approved', 'commented', 'superseded')),
  signer_name text,
  comment text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '45 days'),
  last_sent_at timestamptz,
  decided_at timestamptz
);

create index on public.checklist_approval_requests (instance_id, gate_key);

alter table public.checklist_approval_requests enable row level security;

create policy "members read approval requests"
  on public.checklist_approval_requests for select
  to authenticated
  using (
    exists (
      select 1 from public.checklist_instances ci
      where ci.id = checklist_approval_requests.instance_id
        and public.has_project_role(ci.project_id, array['admin', 'field_engineer']::public.user_role[])
    )
  );

-- Approval state lives in checklist_instances.gates. Only the workflow (service role) may change it, so a field
-- engineer's browser can never mark a stage as approved or overwrite an approval while saving other fields.
create or replace function public.checklist_protect_gates()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'INSERT' then
      new.gates := '{}'::jsonb;
    elsif new.gates is distinct from old.gates then
      raise exception 'Checklist approval state can only be changed by the approval workflow';
    end if;
  end if;
  return new;
end;
$$;

create trigger checklist_protect_gates
  before insert or update on public.checklist_instances
  for each row execute function public.checklist_protect_gates();
