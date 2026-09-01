import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useProjectBySlug } from '../../lib/useProject';
import { supabase } from '../../lib/supabase';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportSettingsPage() {
  const { slug } = useParams<{ slug: string }>();
  const { project, loading: projectLoading, error } = useProjectBySlug(slug);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [pausedUntil, setPausedUntil] = useState<string | null>(null);
  const [suspendDate, setSuspendDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;
    supabase
      .from('project_config')
      .select('key, value')
      .eq('project_id', project.id)
      .in('key', ['report_recipients', 'report_paused_until'])
      .then(({ data }) => {
        if (cancelled) return;
        const recipientsRow = data?.find((r) => r.key === 'report_recipients');
        const pausedRow = data?.find((r) => r.key === 'report_paused_until');
        setRecipients((recipientsRow?.value as string[] | undefined) ?? []);
        setPausedUntil((pausedRow?.value as string | null | undefined) ?? null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [project?.id]);

  async function saveRecipients(next: string[]) {
    if (!project?.id) return;
    setSaving(true);
    setMessage(null);
    const { error: upsertError } = await supabase
      .from('project_config')
      .upsert({ project_id: project.id, key: 'report_recipients', value: next }, { onConflict: 'project_id,key' });
    setSaving(false);
    if (upsertError) {
      setMessage(`Save failed: ${upsertError.message}`);
      return;
    }
    setRecipients(next);
  }

  function handleAddEmail() {
    const email = newEmail.trim();
    if (!email || recipients.includes(email)) return;
    saveRecipients([...recipients, email]);
    setNewEmail('');
  }

  function handleRemoveEmail(email: string) {
    saveRecipients(recipients.filter((e) => e !== email));
  }

  async function handleSuspend() {
    if (!project?.id || !suspendDate) return;
    setSaving(true);
    setMessage(null);
    const { error: upsertError } = await supabase
      .from('project_config')
      .upsert({ project_id: project.id, key: 'report_paused_until', value: suspendDate }, { onConflict: 'project_id,key' });
    setSaving(false);
    if (upsertError) {
      setMessage(`Save failed: ${upsertError.message}`);
      return;
    }
    setPausedUntil(suspendDate);
    setSuspendDate('');
  }

  async function handleResume() {
    if (!project?.id) return;
    setSaving(true);
    setMessage(null);
    const { error: upsertError } = await supabase
      .from('project_config')
      .upsert({ project_id: project.id, key: 'report_paused_until', value: null }, { onConflict: 'project_id,key' });
    setSaving(false);
    if (upsertError) {
      setMessage(`Save failed: ${upsertError.message}`);
      return;
    }
    setPausedUntil(null);
  }

  if (projectLoading || loading) return <div className="page-loading">Loading…</div>;
  if (error || !project) return <div className="page-loading">Project not found.</div>;

  const isPaused = !!pausedUntil && pausedUntil >= todayIso();

  return (
    <div className="project-shell">
      <header className="project-topbar">
        <div className="project-topbar-left">
          <Link to={`/admin/${project.slug}`}>← {project.name}</Link>
          <h1>Report settings</h1>
        </div>
      </header>

      <div className="wizard-page">
        <div className="wizard-form">
          <h2>Daily report recipients</h2>
          <p className="wizard-hint">
            Everyone on this list gets the Daily Progress Report PDF automatically at 23:59 (Georgia time).
          </p>

          <fieldset className="wizard-fieldset">
            {recipients.length === 0 && <p className="accordion-empty">No recipients yet — add one below.</p>}
            {recipients.map((email) => (
              <div key={email} className="wizard-work-item-row">
                <input type="text" className="wizard-label-input" value={email} readOnly />
                <button
                  type="button"
                  className="items-editor-remove-btn"
                  onClick={() => handleRemoveEmail(email)}
                  title="Remove recipient"
                  disabled={saving}
                >
                  ×
                </button>
              </div>
            ))}
          </fieldset>

          <div className="wizard-form-row">
            <input
              type="email"
              placeholder="name@company.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddEmail();
                }
              }}
            />
            <button type="button" className="wizard-secondary-btn" onClick={handleAddEmail} disabled={saving || !newEmail.trim()}>
              + Add recipient
            </button>
          </div>

          <h2 style={{ marginTop: 32 }}>Pause sending</h2>
          <p className="wizard-hint">
            Suspend the automatic daily email for a break (holidays, year-end) without touching the recipient list.
          </p>

          {isPaused ? (
            <div className="wizard-form-row" style={{ alignItems: 'center' }}>
              <p>
                Sending is suspended until <strong>{pausedUntil}</strong>.
              </p>
              <button type="button" onClick={handleResume} disabled={saving}>
                Resume sending
              </button>
            </div>
          ) : (
            <div className="wizard-form-row" style={{ alignItems: 'center' }}>
              <input type="date" min={todayIso()} value={suspendDate} onChange={(e) => setSuspendDate(e.target.value)} />
              <button type="button" className="modal-danger-btn" onClick={handleSuspend} disabled={saving || !suspendDate}>
                Suspend sending until this date
              </button>
            </div>
          )}

          {message && <p className="form-message">{message}</p>}
        </div>
      </div>
    </div>
  );
}
