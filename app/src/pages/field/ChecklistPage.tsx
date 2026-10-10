import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
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
import { effectiveGateStatus, overallStatus, type ChecklistData, type GatesState } from '../../lib/checklists/types';
import { ChecklistForm } from '../../components/checklists/ChecklistForm';
import { ChecklistSheet } from '../../components/checklists/ChecklistSheet';
import { GateStatusPill } from '../../components/checklists/GateStatusPill';
import '../../components/checklists/checklist.css';

/** One tower's checklist: fill in (form), preview / print the paper-style sheet in English + a chosen language. */
export default function ChecklistPage() {
  const { slug, templateKey = 'foundation', assetCode = '' } = useParams<{ slug: string; templateKey: string; assetCode: string }>();
  const { user } = useAuth();
  const { language } = useLanguage();
  const template = TEMPLATES[templateKey];
  const { project, loading: projectLoading } = useProjectBySlug(slug);
  const { assets, loading: assetsLoading } = useAssets(project?.id);
  const asset = useMemo(() => assets.find((a) => a.asset_code === assetCode), [assets, assetCode]);
  const { instance, loading, error, save } = useChecklist(project?.id, asset?.id, templateKey, template?.version ?? 1);

  const [data, setData] = useState<ChecklistData>({});
  const [gates, setGates] = useState<GatesState>({});
  const [docNo, setDocNo] = useState('');
  const [rev, setRev] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [view, setView] = useState<'form' | 'sheet'>('form');
  const [printLang, setPrintLang] = useState<LanguageCode | 'en'>(language === 'en' ? 'en' : language);
  const [prefilledKeys, setPrefilledKeys] = useState<ReadonlySet<string>>(new Set());
  const branding = useChecklistBranding(project);

  // Load saved values, then fill still-empty fields from the tower record (type, setting level, leg extensions).
  useEffect(() => {
    if (!asset || loading || !template) return;
    const saved = instance?.data ?? {};
    const filled = prefillFromAsset(template, asset, saved, project?.slug ?? '');
    setData({ ...filled, ...saved });
    setPrefilledKeys(new Set(Object.keys(filled)));
    setGates(instance?.gates ?? {});
    setDocNo(instance?.doc_no ?? '');
    setRev(instance?.rev ?? '');
    setDirty(false);
  }, [instance?.id, instance?.updated_at, asset?.id, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!template) return <div className="page-loading">Unknown checklist: {templateKey}</div>;
  if (projectLoading || assetsLoading || loading || !branding) return <div className="page-loading">…</div>;
  if (!project || !asset) return <div className="page-loading">Tower {assetCode} not found.</div>;

  const overall = overallStatus(template, gates);
  const backTo = `/field/${project.slug}`;

  function onChange(key: string, value: string) {
    setData((d) => ({ ...d, [key]: value }));
    setPrefilledKeys((p) => {
      if (!p.has(key)) return p;
      const n = new Set(p);
      n.delete(key);
      return n;
    });
    setDirty(true);
  }

  async function doSave(nextGates: GatesState, action: string, detail?: Record<string, unknown>) {
    const { error: err } = await save({ data, gates: nextGates, doc_no: docNo, rev }, { action, detail });
    if (err) setMessage(err);
    else {
      setMessage(lab('ui.saved', language));
      setDirty(false);
    }
    return !err;
  }

  async function handleSave() {
    setSaving(true);
    setMessage('');
    await doSave(gates, 'save');
    setSaving(false);
  }

  async function handleSubmitGate(gateKey: string) {
    const gate = template.gates.find((g) => g.key === gateKey);
    if (!gate || !window.confirm(`${lab(gate.label, language)}: ${lab('ui.submitGate', language)}?`)) return;
    setSubmitting(gateKey);
    const next: GatesState = {
      ...gates,
      [gateKey]: { status: 'submitted', submitted_at: new Date().toISOString(), submitted_by: user?.email ?? '', approvals: { consultant: { status: 'pending' }, employer: { status: 'pending' } } },
    };
    if (await doSave(next, 'submit_gate', { gate: gateKey })) setGates(next);
    setSubmitting(null);
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
          <button type="button" onClick={() => window.print()}>
            🖨 {lab('ui.print', language)}
          </button>
          <button type="button" className="ck-save" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? lab('ui.saving', language) : lab('ui.saveDraft', language)}
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
          <ChecklistForm template={template} data={data} gates={gates} lang={language} editable onChange={onChange} onSubmitGate={handleSubmitGate} submitting={submitting} prefilled={prefilledKeys} />
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
        />
      </div>
    </div>
  );
}
