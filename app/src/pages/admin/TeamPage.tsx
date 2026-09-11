import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { useProjectBySlug } from '../../lib/useProject';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/i18n/LanguageContext';
import type { ProjectRole } from '../../lib/useProjectRoles';

interface MemberRow {
  id: string;
  user_id: string;
  role: ProjectRole;
  email: string;
}

const INVITABLE_ROLES: Extract<ProjectRole, 'admin' | 'field_engineer'>[] = ['admin', 'field_engineer'];

export default function TeamPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { project, loading: projectLoading, error } = useProjectBySlug(slug);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<ProjectRole>('field_engineer');
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busyRowId, setBusyRowId] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    if (!project?.id) return;
    setMembersLoading(true);
    const { data: roleRows, error: roleError } = await supabase
      .from('user_project_roles')
      .select('id, user_id, role')
      .eq('project_id', project.id);
    if (roleError || !roleRows) {
      setMembersLoading(false);
      return;
    }
    const userIds = roleRows.map((r) => r.user_id);
    const { data: profileRows } = userIds.length
      ? await supabase.from('profiles').select('id, email').in('id', userIds)
      : { data: [] };
    const emailById = new Map((profileRows ?? []).map((p) => [p.id, p.email as string]));
    setMembers(
      roleRows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        role: r.role as ProjectRole,
        email: emailById.get(r.user_id) ?? '—',
      })),
    );
    setMembersLoading(false);
  }, [project?.id]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const adminCount = members.filter((m) => m.role === 'admin').length;

  async function handleInvite() {
    if (!project?.id || !inviteEmail.trim()) return;
    setInviting(true);
    setMessage(null);
    const { data, error: invokeError } = await supabase.functions.invoke('invite-project-member', {
      body: { projectId: project.id, email: inviteEmail.trim(), role: inviteRole },
    });
    setInviting(false);
    if (invokeError || data?.error) {
      setMessage(t('common.saveFailed', { message: data?.error ?? invokeError?.message ?? 'unknown error' }));
      return;
    }
    setMessage(data?.created ? t('team.inviteSentNew') : t('team.inviteSentExisting'));
    setInviteEmail('');
    loadMembers();
  }

  async function handleRoleChange(row: MemberRow, nextRole: ProjectRole) {
    setBusyRowId(row.id);
    const { error: updateError } = await supabase.from('user_project_roles').update({ role: nextRole }).eq('id', row.id);
    setBusyRowId(null);
    if (updateError) {
      setMessage(t('common.saveFailed', { message: updateError.message }));
      return;
    }
    loadMembers();
  }

  async function handleRemove(row: MemberRow) {
    setBusyRowId(row.id);
    const { error: deleteError } = await supabase.from('user_project_roles').delete().eq('id', row.id);
    setBusyRowId(null);
    if (deleteError) {
      setMessage(t('common.saveFailed', { message: deleteError.message }));
      return;
    }
    loadMembers();
  }

  if (projectLoading) return <div className="page-loading">{t('common.loading')}</div>;
  if (error || !project) return <div className="page-loading">{t('common.projectNotFound')}</div>;

  return (
    <div className="project-shell">
      <header className="project-topbar">
        <div className="project-topbar-left">
          <Link to={`/admin/${project.slug}`}>← {project.name}</Link>
          <h1>{t('team.title')}</h1>
        </div>
      </header>

      <div className="wizard-page">
        <div className="wizard-form">
          <h2>{t('team.membersHeading')}</h2>
          {membersLoading && <p className="wizard-hint">{t('common.loading')}</p>}
          {!membersLoading && members.length === 0 && <p className="accordion-empty">{t('team.noMembers')}</p>}

          <fieldset className="wizard-fieldset">
            {members.map((row) => {
              const isSelf = row.user_id === user?.id;
              const isLastAdmin = row.role === 'admin' && adminCount <= 1;
              const locked = isSelf && isLastAdmin;
              return (
                <div key={row.id} className="wizard-work-item-row">
                  <span className="wizard-label-input" style={{ flex: 1 }}>
                    {row.email}
                    {isSelf && ` (${t('team.you')})`}
                  </span>
                  <select
                    value={row.role}
                    disabled={locked || busyRowId === row.id}
                    onChange={(e) => handleRoleChange(row, e.target.value as ProjectRole)}
                  >
                    {INVITABLE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r === 'admin' ? t('team.roleAdmin') : t('team.roleFieldEngineer')}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="items-editor-remove-btn"
                    onClick={() => handleRemove(row)}
                    disabled={locked || busyRowId === row.id}
                    title={locked ? t('team.lastAdminHint') : t('team.remove')}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </fieldset>

          <h2 style={{ marginTop: 32 }}>{t('team.inviteHeading')}</h2>
          <p className="wizard-hint">{t('team.inviteHint')}</p>
          <div className="wizard-form-row">
            <input
              type="email"
              placeholder="name@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleInvite();
                }
              }}
            />
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as ProjectRole)}>
              {INVITABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r === 'admin' ? t('team.roleAdmin') : t('team.roleFieldEngineer')}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="wizard-secondary-btn"
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim()}
            >
              {inviting ? t('team.inviting') : t('team.inviteButton')}
            </button>
          </div>

          {message && <p className="form-message">{message}</p>}
        </div>
      </div>
    </div>
  );
}
