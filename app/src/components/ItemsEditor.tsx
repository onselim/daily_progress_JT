import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { WorkItemConfig } from '../lib/useProjectConfig';

function newItemKey(): string {
  return `item_${Math.random().toString(36).slice(2, 10)}`;
}

interface ItemsEditorProps {
  projectId: string;
  configKey: 'design_items' | 'supply_items';
  title: string;
  hint: string;
  onComplete: () => void;
  onBack?: () => void;
}

export function ItemsEditor({ projectId, configKey, title, hint, onComplete, onBack }: ItemsEditorProps) {
  const [items, setItems] = useState<WorkItemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('project_config')
      .select('value')
      .eq('project_id', projectId)
      .eq('key', configKey)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setItems(((data?.value as WorkItemConfig[] | undefined) ?? []).map((it) => ({ ...it })));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, configKey]);

  const totalWeight = items.reduce((sum, item) => sum + (item.weight || 0), 0);
  const totalRounded = Math.round(totalWeight * 10) / 10;

  function handleLabelChange(key: string, label: string) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, label } : it)));
  }

  function handleWeightChange(key: string, weight: number) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, weight } : it)));
  }

  function handleAdd() {
    setItems((prev) => {
      const targetShare = prev.length > 0 ? 100 / (prev.length + 1) : 100;
      const scale = prev.length > 0 ? (100 - targetShare) / totalWeight : 1;
      const scaled = totalWeight > 0 ? prev.map((it) => ({ ...it, weight: Math.round(it.weight * scale * 10) / 10 })) : prev;
      return [...scaled, { key: newItemKey(), label: '', weight: Math.round(targetShare * 10) / 10 }];
    });
  }

  function handleRemove(key: string) {
    setItems((prev) => {
      const removed = prev.find((it) => it.key === key);
      const remaining = prev.filter((it) => it.key !== key);
      if (!removed) return remaining;
      const remainingSum = remaining.reduce((s, it) => s + (it.weight || 0), 0);
      if (remainingSum <= 0) return remaining;
      return remaining.map((it) => ({
        ...it,
        weight: Math.round((it.weight + (it.weight / remainingSum) * removed.weight) * 10) / 10,
      }));
    });
  }

  function handleAutoDistribute() {
    if (totalWeight <= 0) return;
    setItems((prev) => prev.map((it) => ({ ...it, weight: Math.round(((it.weight || 0) / totalWeight) * 1000) / 10 })));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const cleaned = items.filter((it) => it.label.trim() !== '').map((it) => ({ ...it, label: it.label.trim() }));

    const { error: upsertError } = await supabase
      .from('project_config')
      .upsert({ project_id: projectId, key: configKey, value: cleaned }, { onConflict: 'project_id,key' });

    setSaving(false);
    if (upsertError) {
      setError(upsertError.message);
      return;
    }
    onComplete();
  }

  if (loading) return <p className="accordion-empty">Loading…</p>;

  return (
    <div className="wizard-form">
      <h2>{title}</h2>
      <p className="wizard-hint">{hint}</p>

      <fieldset className="wizard-fieldset">
        {items.length === 0 && <p className="accordion-empty">No items yet — add one below.</p>}
        {items.map((item) => (
          <div key={item.key} className="wizard-work-item-row">
            <input
              type="text"
              className="wizard-label-input"
              value={item.label}
              placeholder="Item name…"
              onChange={(e) => handleLabelChange(item.key, e.target.value)}
            />
            <input
              type="number"
              min={0}
              className="wizard-weight-input"
              value={item.weight}
              onChange={(e) => handleWeightChange(item.key, Number(e.target.value))}
            />
            <button
              type="button"
              className="items-editor-remove-btn"
              onClick={() => handleRemove(item.key)}
              title="Remove item"
            >
              ×
            </button>
          </div>
        ))}
      </fieldset>

      <button type="button" className="wizard-secondary-btn" onClick={handleAdd}>
        + Add item
      </button>

      <div className={`wizard-weight-total${totalRounded === 100 ? ' ok' : ' warn'}`}>
        <span>
          Total weight: <strong>{totalRounded}</strong> / 100
          {totalRounded === 100 ? ' ✓' : ''}
        </span>
        <button type="button" className="wizard-secondary-btn" onClick={handleAutoDistribute}>
          Auto-distribute
        </button>
      </div>

      {error && <p className="form-message">{error}</p>}

      <div className="wizard-actions">
        {onBack ? (
          <button type="button" onClick={onBack} className="wizard-secondary-btn">
            Back
          </button>
        ) : (
          <span />
        )}
        <button type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
