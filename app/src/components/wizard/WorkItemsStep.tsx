import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { WorkItemConfig } from '../../lib/useProjectConfig';
import { useLanguage } from '../../lib/i18n/LanguageContext';

export const DEFAULT_WORK_ITEM_TEMPLATE: WorkItemConfig[] = [
  { group: 'PRE-CONSTRUCTION WORKS', key: 'ar', label: 'Access Road', weight: 8 },
  { group: 'PRE-CONSTRUCTION WORKS', key: 'pc_tc', label: 'Tree Cutting', weight: 5 },
  { group: 'PRE-CONSTRUCTION WORKS', key: 'si_sw', label: 'Soil Investigation', weight: 4 },
  { group: 'FOUNDATION', key: 'fn_ex', label: 'Excavation', weight: 8 },
  { group: 'FOUNDATION', key: 'fn_lc', label: 'Lean Concrete', weight: 2 },
  { group: 'FOUNDATION', key: 'fn_ss', label: 'Stub Settings', weight: 3 },
  { group: 'FOUNDATION', key: 'fn_rf', label: 'Reinforcement', weight: 4 },
  { group: 'FOUNDATION', key: 'fn_fw', label: 'Formwork', weight: 4 },
  { group: 'FOUNDATION', key: 'fn_co', label: 'Concreting', weight: 26 },
  { group: 'FOUNDATION', key: 'fn_bf', label: 'Backfilling', weight: 4 },
  { group: 'ERECTION', key: 'er_ge', label: 'Ground Assembly', weight: 8 },
  { group: 'ERECTION', key: 'er_te', label: 'Erection of Towers', weight: 8 },
  { group: 'STRINGING', key: 'st_cd', label: 'Stringing of Conductor', weight: 10 },
  { group: 'STRINGING', key: 'st_sg', label: 'Sagging + Conductor Accessories', weight: 2 },
  { group: 'STRINGING', key: 'st_op', label: 'Stringing of OPGW', weight: 2 },
  { group: 'STRINGING', key: 'st_ew', label: 'Stringing of EW', weight: 2 },
];

function mergeTemplate(initialItems: WorkItemConfig[] | undefined): WorkItemConfig[] {
  if (!initialItems) return DEFAULT_WORK_ITEM_TEMPLATE;
  const byKey = new Map(DEFAULT_WORK_ITEM_TEMPLATE.map((item) => [item.key, item]));
  for (const item of initialItems) {
    if (!byKey.has(item.key)) byKey.set(item.key, item);
  }
  return Array.from(byKey.values());
}

interface WorkItemsStepProps {
  projectId: string;
  initialItems?: WorkItemConfig[];
  title?: string;
  submitLabel?: string;
  onComplete: () => void;
  onBack?: () => void;
}

export function WorkItemsStep({
  projectId,
  initialItems,
  title,
  submitLabel,
  onComplete,
  onBack,
}: WorkItemsStepProps) {
  const { t, n } = useLanguage();
  const resolvedTitle = title ?? t('wizard.stepWorkItems');
  const resolvedSubmitLabel = submitLabel ?? t('wizard.nextImport');
  const allItems = mergeTemplate(initialItems);
  const enabledKeys = new Set((initialItems ?? DEFAULT_WORK_ITEM_TEMPLATE).map((item) => item.key));
  const weightByKey = new Map((initialItems ?? DEFAULT_WORK_ITEM_TEMPLATE).map((item) => [item.key, item.weight]));

  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(allItems.map((item) => [item.key, enabledKeys.has(item.key)])),
  );
  const [weights, setWeights] = useState<Record<string, number>>(
    Object.fromEntries(allItems.map((item) => [item.key, weightByKey.get(item.key) ?? item.weight])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeItems = allItems.filter((item) => enabled[item.key]);
  const totalWeight = activeItems.reduce((sum, item) => sum + (weights[item.key] || 0), 0);
  const totalRounded = Math.round(totalWeight * 10) / 10;

  function handleAutoDistribute() {
    if (totalWeight <= 0) return;
    setWeights((prev) => {
      const next = { ...prev };
      for (const item of activeItems) {
        next[item.key] = Math.round(((prev[item.key] || 0) / totalWeight) * 1000) / 10;
      }
      return next;
    });
  }

  const groups: { name: string; items: WorkItemConfig[] }[] = [];
  for (const item of allItems) {
    let group = groups.find((g) => g.name === item.group);
    if (!group) {
      group = { name: item.group ?? t('assetEditor.workItems'), items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);

    const workItems: WorkItemConfig[] = allItems
      .filter((item) => enabled[item.key])
      .map((item) => ({ ...item, weight: weights[item.key] }));

    const { error: upsertError } = await supabase
      .from('project_config')
      .upsert({ project_id: projectId, key: 'work_items', value: workItems }, { onConflict: 'project_id,key' });

    setSaving(false);
    if (upsertError) {
      setError(upsertError.message);
      return;
    }
    onComplete();
  }

  return (
    <div className="wizard-form">
      <h2>{resolvedTitle}</h2>
      <p className="wizard-hint">{t('wizard.workItemsHint')}</p>

      {groups.map((group) => (
        <fieldset key={group.name} className="wizard-fieldset">
          <legend>{group.name}</legend>
          {group.items.map((item) => (
            <div key={item.key} className="wizard-work-item-row">
              <label className="wizard-checkbox-label">
                <input
                  type="checkbox"
                  checked={enabled[item.key]}
                  onChange={(e) => {
                    const isEnabling = e.target.checked;
                    setEnabled((prev) => ({ ...prev, [item.key]: isEnabling }));

                    if (!isEnabling) {
                      const freed = weights[item.key] || 0;
                      const siblings = group.items.filter((sib) => sib.key !== item.key && enabled[sib.key]);
                      const siblingSum = siblings.reduce((sum, sib) => sum + (weights[sib.key] || 0), 0);
                      if (freed > 0 && siblingSum > 0) {
                        setWeights((prev) => {
                          const next = { ...prev };
                          for (const sib of siblings) {
                            next[sib.key] = Math.round((prev[sib.key] + (prev[sib.key] / siblingSum) * freed) * 10) / 10;
                          }
                          return next;
                        });
                      }
                    }
                  }}
                />
                {item.label}
              </label>
              <input
                type="number"
                min={0}
                className="wizard-weight-input"
                value={weights[item.key]}
                disabled={!enabled[item.key]}
                onChange={(e) => setWeights((prev) => ({ ...prev, [item.key]: Number(e.target.value) }))}
              />
            </div>
          ))}
        </fieldset>
      ))}

      <div className={`wizard-weight-total${totalRounded === 100 ? ' ok' : ' warn'}`}>
        <span>
          {t('items.totalWeight')}: <strong>{n(totalRounded)}</strong> / {n(100)}
          {totalRounded === 100 ? ' ✓' : ''}
        </span>
        <button type="button" className="wizard-secondary-btn" onClick={handleAutoDistribute}>
          {t('items.autoDistribute')}
        </button>
      </div>

      {error && <p className="form-message">{error}</p>}

      <div className="wizard-actions">
        {onBack ? (
          <button type="button" onClick={onBack} className="wizard-secondary-btn">
            {t('common.back')}
          </button>
        ) : (
          <span />
        )}
        <button type="button" onClick={handleSubmit} disabled={saving}>
          {saving ? t('common.saving') : resolvedSubmitLabel}
        </button>
      </div>
    </div>
  );
}
