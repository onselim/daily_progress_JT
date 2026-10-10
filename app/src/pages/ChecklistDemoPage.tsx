import { useState } from 'react';
import { foundationTemplate } from '../lib/checklists/foundation';
import { ChecklistForm } from '../components/checklists/ChecklistForm';
import { ChecklistSheet } from '../components/checklists/ChecklistSheet';
import type { ChecklistData, GatesState } from '../lib/checklists/types';
import { LANGUAGES, type LanguageCode } from '../lib/i18n/languages';
import '../components/checklists/checklist.css';

/** Development-only sandbox (route only exists under `vite dev`): renders the foundation checklist with sample data and no
 * database, so layout and printing can be checked in every language without logging in. */
export default function ChecklistDemoPage() {
  const params = new URLSearchParams(window.location.search);
  const lang = (params.get('lang') ?? 'ka') as LanguageCode;
  const [data, setData] = useState<ChecklistData>({
    towerType: 'B30-3', settingLevel: '312.4', foundClass: 'A',
    'stubmat.leg1.legExt': '+1.5', 'stubmat.leg2.legExt': '+1.5', 'stubmat.leg3.legExt': '0', 'stubmat.leg4.legExt': '0',
    'exc.depth.leg1': '240', 'exc.depth.leg2': '238',
    'levels.measured.leg1': '312.41', 'levels.required.leg1': '312.40',
    'distB.required.1-2': '3200', 'distB.before.1-2': '3198',
    comments_C: 'Dry soil, no dewatering.',
  });
  const [gates, setGates] = useState<GatesState>({
    class: { status: 'submitted', submitted_at: '2026-10-10T08:00:00Z', submitted_by: 'field@example.com', approvals: { consultant: { status: 'approved', name: 'A. Consultant', at: '2026-10-10T10:00:00Z' }, employer: { status: 'pending' } } },
    concreting: { status: 'draft' },
  });
  const [view, setView] = useState(params.get('view') ?? 'sheet');
  const second: LanguageCode | null = lang === 'en' ? null : lang;
  return (
    <div className="ck-page">
      <div className="ck-noprint ck-actions">
        {['form', 'sheet'].map((v) => <button key={v} type="button" onClick={() => setView(v)}>{v}</button>)}
        {LANGUAGES.map((l) => <a key={l.code} href={`?lang=${l.code}&view=${view}`}>{l.code}</a>)}
        <button type="button" onClick={() => setGates({ ...gates, class: { ...gates.class, approvals: { consultant: { status: 'approved', name: 'A. Consultant', at: '2026-10-10' }, employer: { status: 'approved', name: 'B. Employer', at: '2026-10-11' } } }, concreting: { status: 'submitted', approvals: { consultant: { status: 'approved' }, employer: { status: 'approved' } } }, backfill: { status: 'submitted', approvals: { consultant: { status: 'approved' }, employer: { status: 'approved' } } } })}>approve all</button>
      </div>
      {view === 'form' ? (
        <div className="ck-noprint">
          <ChecklistForm template={foundationTemplate} data={data} gates={gates} lang={lang} editable onChange={(k, v) => setData({ ...data, [k]: v })} onSubmitGate={() => {}} submitting={null} />
        </div>
      ) : (
        <div className="ck-sheet-wrap">
          <ChecklistSheet template={foundationTemplate} data={data} gates={gates} second={second} header={{ docNo: 'FW-T8', rev: 'R0', towerNo: '8' }} branding={{ employer: { name: 'Georgian State Electrosystem, GSE', logos: ['gse.png'] }, contractor: { name: 'Bozlar Yapı', logos: ['bozlar.png'] }, consultant: { name: 'DECON Int. Consulting', logos: ['decon.png', 'consulectra.png', 'afry.png'] } }} />
        </div>
      )}
    </div>
  );
}
