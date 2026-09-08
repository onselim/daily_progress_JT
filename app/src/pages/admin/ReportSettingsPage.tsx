import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useProjectBySlug } from '../../lib/useProject';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/i18n/LanguageContext';
import { LANGUAGES, DEFAULT_LANGUAGE, MAX_REPORT_LANGUAGES, isLanguageCode, type LanguageCode } from '../../lib/i18n/languages';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportSettingsPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useLanguage();
  const { project, loading: projectLoading, error } = useProjectBySlug(slug);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [pausedUntil, setPausedUntil] = useState<string | null>(null);
  const [suspendDate, setSuspendDate] = useState('');
  const [reportLanguages, setReportLanguages] = useState<LanguageCode[]>([DEFAULT_LANGUAGE]);
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
      .in('key', ['report_recipients', 'report_paused_until', 'report_languages', 'report_language'])
      .then(({ data }) => {
        if (cancelled) return;
        const recipientsRow = data?.find((r) => r.key === 'report_recipients');
        const pausedRow = data?.find((r) => r.key === 'report_paused_until');
        setRecipients((recipientsRow?.value as string[] | undefined) ?? []);
        setPausedUntil((pausedRow?.value as string | null | undefined) ?? null);

        // `report_languages` (array, up to MAX_REPORT_LANGUAGES) is the current shape;
        // fall back to the older single `report_language` value for projects set up
        // before multi-language reports existed.
        const languagesRow = data?.find((r) => r.key === 'report_languages');
        const legacyLanguageRow = data?.find((r) => r.key === 'report_language');
        const languagesValue = languagesRow?.value;
        let nextLanguages = Array.isArray(languagesValue) ? languagesValue.filter(isLanguageCode) : [];
        if (nextLanguages.length === 0) {
          const legacy = legacyLanguageRow?.value as string | undefined;
          nextLanguages = isLanguageCode(legacy) ? [legacy] : [DEFAULT_LANGUAGE];
        }
        setReportLanguages(nextLanguages.slice(0, MAX_REPORT_LANGUAGES));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [project?.id]);

  async function saveLanguages(next: LanguageCode[]) {
    if (!project?.id || next.length === 0) return;
    setSaving(true);
    setMessage(null);
    const { error: upsertError } = await supabase
      .from('project_config')
      .upsert({ project_id: project.id, key: 'report_languages', value: next }, { onConflict: 'project_id,key' });
    setSaving(false);
    if (upsertError) {
      setMessage(t('common.saveFailed', { message: upsertError.message }));
      return;
    }
    setReportLanguages(next);
  }

  function handleToggleLanguage(code: LanguageCode) {
    if (reportLanguages.includes(code)) {
      if (reportLanguages.length <= 1) return; // always keep at least one selected
      saveLanguages(reportLanguages.filter((c) => c !== code));
    } else {
      if (reportLanguages.length >= MAX_REPORT_LANGUAGES) return;
      saveLanguages([...reportLanguages, code]);
    }
  }

  async function saveRecipients(next: string[]) {
    if (!project?.id) return;
    setSaving(true);
    setMessage(null);
    const { error: upsertError } = await supabase
      .from('project_config')
      .upsert({ project_id: project.id, key: 'report_recipients', value: next }, { onConflict: 'project_id,key' });
    setSaving(false);
    if (upsertError) {
      setMessage(t('common.saveFailed', { message: upsertError.message }));
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
      setMessage(t('common.saveFailed', { message: upsertError.message }));
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
      setMessage(t('common.saveFailed', { message: upsertError.message }));
      return;
    }
    setPausedUntil(null);
  }

  if (projectLoading || loading) return <div className="page-loading">{t('common.loading')}</div>;
  if (error || !project) return <div className="page-loading">{t('common.projectNotFound')}</div>;

  const isPaused = !!pausedUntil && pausedUntil >= todayIso();

  return (
    <div className="project-shell">
      <header className="project-topbar">
        <div className="project-topbar-left">
          <Link to={`/admin/${project.slug}`}>← {project.name}</Link>
          <h1>{t('reportSettings.title')}</h1>
        </div>
      </header>

      <div className="wizard-page">
        <div className="wizard-form">
          <h2>{t('reportSettings.recipientsHeading')}</h2>
          <p className="wizard-hint">{t('reportSettings.recipientsHint')}</p>

          <fieldset className="wizard-fieldset">
            {recipients.length === 0 && <p className="accordion-empty">{t('reportSettings.noRecipients')}</p>}
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
              {t('reportSettings.addRecipient')}
            </button>
          </div>

          <h2 style={{ marginTop: 32 }}>{t('reportSettings.languageHeading')}</h2>
          <p className="wizard-hint">{t('reportSettings.languageHint', { max: MAX_REPORT_LANGUAGES })}</p>
          <div className="language-checkbox-grid">
            {LANGUAGES.map((l) => {
              const checked = reportLanguages.includes(l.code);
              const disableAdd = !checked && reportLanguages.length >= MAX_REPORT_LANGUAGES;
              const disableRemove = checked && reportLanguages.length <= 1;
              return (
                <label key={l.code} className="wizard-checkbox-label language-checkbox-label">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={saving || disableAdd || disableRemove}
                    onChange={() => handleToggleLanguage(l.code)}
                  />
                  {l.label}
                </label>
              );
            })}
          </div>

          <h2 style={{ marginTop: 32 }}>{t('reportSettings.pauseHeading')}</h2>
          <p className="wizard-hint">{t('reportSettings.pauseHint')}</p>

          {isPaused ? (
            <div className="wizard-form-row" style={{ alignItems: 'center' }}>
              <p>{t('reportSettings.suspendedUntil', { date: pausedUntil ?? '' })}</p>
              <button type="button" onClick={handleResume} disabled={saving}>
                {t('reportSettings.resumeSending')}
              </button>
            </div>
          ) : (
            <div className="wizard-form-row" style={{ alignItems: 'center' }}>
              <input type="date" min={todayIso()} value={suspendDate} onChange={(e) => setSuspendDate(e.target.value)} />
              <button type="button" className="modal-danger-btn" onClick={handleSuspend} disabled={saving || !suspendDate}>
                {t('reportSettings.suspendUntil')}
              </button>
            </div>
          )}

          {message && <p className="form-message">{message}</p>}
        </div>
      </div>
    </div>
  );
}
