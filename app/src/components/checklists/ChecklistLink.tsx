import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/i18n/LanguageContext';
import { lab } from '../../lib/checklists/labels';
import { TEMPLATES } from '../../lib/checklists/foundation';
import { effectiveGateStatus, overallStatus, type GatesState } from '../../lib/checklists/types';
import { GateStatusPill } from './GateStatusPill';

/** Tower panel entry for a checklist: opens the form and shows the staged approval state (class / concreting / backfill). */
export function ChecklistLink({ projectSlug, assetId, assetCode, templateKey }: { projectSlug: string; assetId: string; assetCode: string; templateKey: string }) {
  const { language } = useLanguage();
  const template = TEMPLATES[templateKey];
  const [gates, setGates] = useState<GatesState | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('checklist_instances')
      .select('gates')
      .eq('asset_id', assetId)
      .eq('template_key', templateKey)
      .maybeSingle()
      .then(({ data, error }) => {
        // A missing table (migration 0023 not run yet) or no row simply means "not started" here.
        if (!cancelled) setGates(!error && data ? (data.gates as GatesState) : {});
      });
    return () => {
      cancelled = true;
    };
  }, [assetId, templateKey]);

  if (!template || !assetCode.trim()) return null;
  const overall = gates ? overallStatus(template, gates) : 'draft';
  return (
    <fieldset className="ck-asset-link">
      <legend>{lab('ui.checklists', language)}</legend>
      <div className="ck-asset-row">
        <Link className="ck-open" to={`/field/${projectSlug}/checklists/${templateKey}/${encodeURIComponent(assetCode.trim())}`}>
          📋 {lab(template.title, language)} — {lab('ui.open', language)}
        </Link>
        {overall === 'approved' && <span className="ck-pill ck-pill-approved">{lab('ui.status.approved', language)}</span>}
      </div>
      {gates && Object.keys(gates).length > 0 && (
        <div className="ck-asset-gates">
          {template.gates.map((g) => (
            <div key={g.key} className="ck-gate-line">
              <span>{lab(g.label, language)}</span>
              <GateStatusPill status={effectiveGateStatus(gates[g.key])} state={gates[g.key]} lang={language} />
            </div>
          ))}
        </div>
      )}
    </fieldset>
  );
}
