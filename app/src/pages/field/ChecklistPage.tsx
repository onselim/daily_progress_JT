import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useProjectRoles } from '../../lib/useProjectRoles';
import { useProjectBySlug } from '../../lib/useProject';
import { useAssets } from '../../lib/useAssets';
import { LANGUAGES, type LanguageCode } from '../../lib/i18n/languages';
import { useLanguage } from '../../lib/i18n/LanguageContext';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { TEMPLATES } from '../../lib/checklists/foundation';
import { lab } from '../../lib/checklists/labels';
import { prefillFromAsset } from '../../lib/checklists/data';
import { useChecklist } from '../../lib/checklists/useChecklist';
import { useChecklistBranding } from '../../lib/checklists/branding';
import { useProjectModules } from '../../lib/modules';
import { effectiveGateStatus, overallStatus, type ChecklistData, type GatesState } from '../../lib/checklists/types';
import { ChecklistForm } from '../../components/checklists/ChecklistForm';
import { ChecklistSheet } from '../../components/checklists/ChecklistSheet';
import { GateStatusPill } from '../../components/checklists/GateStatusPill';
import '../../components/checklists/checklist.css';

/** One tower's checklist: fill in (form), preview / print the paper-style sheet in English + a chosen language. */
export default function ChecklistPage() {
  const { slug, templateKey = 'foundation', assetCode = '' } = useParams<{ slug: string; templateKey: string; assetCode: string }>();
  const { language } = useLanguage();
  const template = TEMPLATES[templateKey];
  const { project, loading: projectLoading } = useProjectBySlug(slug);
  const { assets, loading: assetsLoading } = useAssets(project?.id);
  const asset = useMemo(() => assets.find((a) => a.asset_code === assetCode), [assets, assetCode]);
  const navigate = useNavigate();
  const { roles } = useProjectRoles();
  const isAdmin = roles.some((r) => r.project.slug === slug && r.role === 'admin');
  const { instance, loading, error, save, reload, notifyGate, resetGate, deleteChecklist } = useChecklist(project?.id, asset?.id, templateKey, template?.version ?? 1);

  const [data, setData] = useState<ChecklistData>({});
  const [gates, setGates] = useState<GatesState>({});
  const [docNo, setDocNo] = useState('');
  const [rev, setRev] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [view, setView] = useState<'form' | 'sheet'>('form');
  const [handwriting, setHandwriting] = useState<boolean>(() => {
    try {
      return localStorage.getItem('checklist_handwriting') !== '0';
    } catch {
      return true;
    }
  });
  const [printLang, setPrintLang] = useState<LanguageCode | 'en'>(language === 'en' ? 'en' : language);
  const [prefilledKeys, setPrefilledKeys] = useState<ReadonlySet<string>>(new Set());
  const branding = useChecklistBranding(project);
  const modules = useProjectModules(project?.id);

  // Load saved values, then fill still-empty fields from the tower record (type, setting level, leg extensions).
  useEffect(() => {
    if (!asset || loading || !template) return;
    const saved = instance?.data ?? {};
    const filled = prefillFromAsset(template, asset, saved, project?.slug ?? '');
    setData({ ...filled, ...saved });
    setPrefilledKeys(new Set(Object.keys(filled)));
    setDocNo(instance?.doc_no ?? '');
    setRev(instance?.rev ?? '');
    setDirty(false);
  }, [instance?.id, asset?.id, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Approval state changes on the server side (reviewers answer through their e-mail links): follow it without touching typed values.
  useEffect(() => {
    setGates(instance?.gates ?? {});
  }, [instance?.gates, instance?.updated_at]);

  // Coming back to the tab (e.g. after a reviewer answered) refreshes the approval status.
  useEffect(() => {
    const onFocus = () => void reload();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [reload]);

  if (!template) return <div className="page-loading">Unknown checklist: {templateKey}</div>;
  if (projectLoading || assetsLoading || loading || modules.loading || !branding) return <div className="page-loading">…</div>;
  if (!project || !asset) return <div className="page-loading">Tower {assetCode} not found.</div>;
  if (!modules.isEnabled(`checklist.${templateKey}`)) return <div className="page-loading">This checklist module is not enabled for this project (Admin → Modules &amp; lists).</div>;

  const overall = overallStatus(template, gates);
  const backTo = `/field/${project.slug}`;

  function onChange(key: string, value: string, opts?: { auto?: boolean }) {
    setData((d) => ({ ...d, [key]: value }));
    setPrefilledKeys((p) => {
      if (opts?.auto) return new Set(p).add(key);
      if (!p.has(key)) return p;
      const n = new Set(p);
      n.delete(key);
      return n;
    });
    setDirty(true);
  }

  async function doSave(action: string, detail?: Record<string, unknown>) {
    const { error: err, id } = await save({ data, doc_no: docNo, rev }, { action, detail });
    if (err) setMessage(err);
    else {
      setMessage(lab('ui.saved', language));
      setDirty(false);
    }
    return err ? null : id;
  }

  async function handleSave() {
    setSaving(true);
    setMessage('');
    await doSave('save');
    setSaving(false);
  }

  /** Saves the current values, then asks the server to submit the stage and e-mail the approval requests. */
  async function submitOrResend(gateKey: string, confirmText: string) {
    const gate = template.gates.find((g) => g.key === gateKey);
    if (!gate || !window.confirm(confirmText)) return;
    setSubmitting(gateKey);
    setMessage('');
    const id = await doSave('save', { before: 'submit_gate', gate: gateKey });
    if (id) {
      const res = await notifyGate(id, gateKey);
      if (res.error) setMessage(res.error);
      else {
        setMessage(`${lab('ui.submitted', language)} ${res.sent.join(', ')}` + (res.missing.length ? ` — no address configured for: ${res.missing.join(', ')}` : ''));
        await reload();
      }
    }
    setSubmitting(null);
  }

  function handleSubmitGate(gateKey: string) {
    const gate = template.gates.find((g) => g.key === gateKey);
    if (gate) void submitOrResend(gateKey, `${lab(gate.label, language)}: ${lab('ui.submitGate', language)}?`);
  }

  function handleResend(gateKey: string) {
    const gate = template.gates.find((g) => g.key === gateKey);
    if (gate) void submitOrResend(gateKey, `${lab(gate.label, language)}: ${lab('ui.resend', language)}?`);
  }

  /** Two-step confirmation for destructive admin actions: a confirm dialog, then the tower number has to be typed. */
  function confirmTwice(warning: string): boolean {
    if (!window.confirm(warning)) return false;
    const typed = window.prompt(`${lab('ui.typeTower', language)}: ${asset!.asset_code}`);
    if (typed == null || typed.trim() !== asset!.asset_code) {
      setMessage(lab('ui.cancelled', language));
      return false;
    }
    return true;
  }

  async function handleReset(gateKey: string) {
    const gate = template.gates.find((g) => g.key === gateKey);
    if (!gate || !instance || !confirmTwice(`${lab(gate.label, language)}\n\n${lab('ui.resetWarn', language)}`)) return;
    setSubmitting(gateKey);
    const err = await resetGate(instance.id, gateKey);
    setMessage(err ?? lab('ui.saved', language));
    await reload();
    setSubmitting(null);
  }

  async function handleDelete() {
    if (!instance || !confirmTwice(lab('ui.deleteWarn', language))) return;
    const err = await deleteChecklist(instance.id);
    if (err) setMessage(err);
    else navigate(backTo);
  }

  const second = printLang === 'en' ? null : printLang;

  return (
    <div className="ck-page">
      <header className="ck-topbar ck-noprint">
        <Link to={backTo}>{lab('ui.back', language)}</Link>
        <div className="ck-topbar-title">
          <h1>
            {lab(template.title, language)} — {lab('towerNo', language)} {asset.asset_code}
          </h1>
          <p>{project.name}</p>
        </div>
        <LanguageSwitcher />
      </header>

      <div className="ck-toolbar ck-noprint">
        <div className="ck-overall">
          <span>{lab('ui.overall', language)}:</span>
          <span className={`ck-pill ck-pill-${overall}`}>{overall === 'inReview' ? lab('ui.status.inReview', language) : lab(`ui.status.${overall}`, language)}</span>
        </div>
        <div className="ck-gates">
          {template.gates.map((g) => (
            <div key={g.key} className="ck-gate-line">
              <span>{lab(g.label, language)}</span>
              <GateStatusPill status={effectiveGateStatus(gates[g.key])} state={gates[g.key]} lang={language} />
            </div>
          ))}
        </div>
        <div className="ck-actions">
          <div className="ck-seg">
            <button type="button" className={view === 'form' ? 'on' : ''} onClick={() => setView('form')}>
              Form
            </button>
            <button type="button" className={view === 'sheet' ? 'on' : ''} onClick={() => setView('sheet')}>
              {lab('ui.print', language)} ▸ preview
            </button>
          </div>
          <label className="ck-printlang">
            {lab('ui.printLang', language)}
            <select value={printLang} onChange={(e) => setPrintLang(e.target.value as LanguageCode)}>
              <option value="en">{lab('ui.englishOnly', language)}</option>
              {LANGUAGES.filter((l) => l.code !== 'en').map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label className="ck-printlang">
            <input
              type="checkbox"
              checked={handwriting}
              onChange={(e) => {
                setHandwriting(e.target.checked);
                try {
                  localStorage.setItem('checklist_handwriting', e.target.checked ? '1' : '0');
                } catch {
                  /* not remembered */
                }
              }}
            />
            ✍ {lab('ui.handwriting', language)}
          </label>
          <button type="button" onClick={() => window.print()}>
            🖨 {lab('ui.print', language)}
          </button>
          <button type="button" className="ck-save" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? lab('ui.saving', language) : lab('ui.saveDraft', language)}
          </button>
          <button type="button" onClick={() => void reload()}>
            ↻ {lab('ui.refresh', language)}
          </button>
          <span className="ck-msg">{dirty ? lab('ui.unsaved', language) : message}</span>
        </div>
        <p className="ck-hint">{lab('ui.approvalNote', language)}</p>
        {error && <p className="ck-error">{lab('ui.loadError', language)} ({error})</p>}
      </div>

      {view === 'form' && (
        <div className="ck-noprint">
          <div className="ck-docrow">
            <label>
              {lab('docNo', language)}
              <input className="ck-input" value={docNo} onChange={(e) => { setDocNo(e.target.value); setDirty(true); }} />
            </label>
            <label>
              {lab('rev', language)}
              <input className="ck-input" value={rev} onChange={(e) => { setRev(e.target.value); setDirty(true); }} />
            </label>
            <p className="ck-prefill">{lab('ui.prefilled', language)}</p>
          </div>
          {isAdmin && instance && (
            <div className="ck-adminzone">
              <button type="button" className="ck-danger" onClick={() => void handleDelete()}>
                {lab('ui.deleteChecklist', language)}
              </button>
            </div>
          )}
          <ChecklistForm template={template} data={data} gates={gates} lang={language} editable onChange={onChange} onSubmitGate={handleSubmitGate} onResend={handleResend} onReset={isAdmin ? handleReset : undefined} submitting={submitting} prefilled={prefilledKeys} />
        </div>
      )}

      <div className={view === 'sheet' ? 'ck-sheet-wrap' : 'ck-sheet-wrap ck-sheet-hidden'}>
        <ChecklistSheet
          template={template}
          data={data}
          gates={gates}
          second={second}
          header={{ docNo, rev, towerNo: asset.asset_code }}
          branding={branding}
          handwriting={handwriting}
        />
      </div>
    </div>
  );
}
