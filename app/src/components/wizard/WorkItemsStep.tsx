import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { WorkItemConfig } from '../../lib/useProjectConfig';

export const DEFAULT_WORK_ITEM_TEMPLATE: WorkItemConfig[] = [
  { group: 'Access Road', key: 'ar', label: 'Access Road', weight: 4 },
  { group: 'Soil Investigation', key: 'si_sw', label: 'Site Work', weight: 3 },
  { group: 'Soil Investigation', key: 'si_ft', label: 'Foundation Type', weight: 2 },
  { group: 'Foundation', key: 'fn_ex', label: 'Excavation', weight: 5 },
  { group: 'Foundation', key: 'fn_lc', label: 'Lean Concrete', weight: 1 },
  { group: 'Foundation', key: 'fn_ss', label: 'Stub Setting', weight: 2 },
  { group: 'Foundation', key: 'fn_rf', label: 'Reinforcement', weight: 3 },
  { group: 'Foundation', key: 'fn_fw', label: 'Formwork', weight: 2 },
  { group: 'Foundation', key: 'fn_co', label: 'Concrete', weight: 15 },
  { group: 'Foundation', key: 'fn_bf', label: 'Backfilling', weight: 2 },
  { group: 'Erection', key: 'er_ge', label: 'Ground Erection', weight: 4 },
  { group: 'Erection', key: 'er_te', label: 'Tower Erection', weight: 5 },
  { group: 'Stringing', key: 'st_cd', label: 'Conductor', weight: 10 },
  { group: 'Stringing', key: 'st_op', label: 'OPGW', weight: 4 },
  { group: 'Stringing', key: 'st_ew', label: 'EW', weight: 4 },
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
  title = '2. Work items',
  submitLabel = 'Next: Import structure list',
  onComplete,
  onBack,
}: WorkItemsStepProps) {
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

  const groups: { name: string; items: WorkItemConfig[] }[] = [];
  for (const item of allItems) {
    let group = groups.find((g) => g.name === item.group);
    if (!group) {
      group = { name: item.group ?? 'Work items', items: [] };
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
      <h2>{title}</h2>
      <p className="wizard-hint">
        Uncheck anything that doesn't apply to this project (e.g. skip Soil Investigation if you only track
        foundation type). Weights feed the Construction% formula.
      </p>

      {groups.map((group) => (
        <fieldset key={group.name} className="wizard-fieldset">
          <legend>{group.name}</legend>
          {group.items.map((item) => (
            <div key={item.key} className="wizard-work-item-row">
              <label className="wizard-checkbox-label">
                <input
                  type="checkbox"
                  checked={enabled[item.key]}
                  onChange={(e) => setEnabled((prev) => ({ ...prev, [item.key]: e.target.checked }))}
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

      {error && <p className="form-message">{error}</p>}

      <div className="wizard-actions">
        {onBack ? (
          <button type="button" onClick={onBack} className="wizard-secondary-btn">
            Back
          </button>
        ) : (
          <span />
        )}
        <button type="button" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </div>
  );
}
