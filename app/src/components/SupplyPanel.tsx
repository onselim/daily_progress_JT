import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { SUPPLY_STATUS_PERCENT, type SupplyItemBreakdown, type SupplyStatus } from '../lib/useSupplyBreakdown';
import { updateProjectWorkItem } from '../lib/updateProjectWorkItem';

const STATUS_OPTIONS: { value: SupplyStatus; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'manufactured', label: 'Manufactured' },
  { value: 'delivered', label: 'Delivered' },
];

interface SupplyPanelProps {
  projectId: string;
  editable: boolean;
  items: SupplyItemBreakdown[];
  overallPercent: number;
  loading: boolean;
  onSaved: () => void;
}

export function SupplyPanel({ projectId, editable, items, overallPercent, loading, onSaved }: SupplyPanelProps) {
  const { user } = useAuth();
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<{ key: string; message: string } | null>(null);

  async function handleSetStatus(itemKey: string, status: SupplyStatus) {
    if (!user) return;
    setSavingKey(itemKey);
    setErrorKey(null);
    try {
      await updateProjectWorkItem({
        projectId,
        category: 'supply',
        workItemKey: itemKey,
        percentComplete: SUPPLY_STATUS_PERCENT[status],
        status,
        updatedBy: user.id,
      });
      onSaved();
    } catch (err) {
      setErrorKey({ key: itemKey, message: err instanceof Error ? err.message : String(err) });
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) return <p className="accordion-empty">Loading…</p>;
  if (items.length === 0) return <p className="accordion-empty">No supply items configured for this project.</p>;

  return (
    <div className="pw-item-list">
      {items.map((item) => (
        <div key={item.key} className="pw-item-row pw-item-row-col">
          <div className="pw-item-row">
            <span className="pw-item-label">{item.label}</span>
            <span className="pw-item-percent">{item.percentComplete.toFixed(1)}%</span>
          </div>
          {editable ? (
            <>
              <div className="status-toggle" role="group" aria-label={item.label}>
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`status-btn status-btn-${
                      opt.value === 'not_started' ? 'not_started' : opt.value === 'manufactured' ? 'in_progress' : 'completed'
                    }${item.status === opt.value ? ' active' : ''}`}
                    disabled={savingKey === item.key}
                    onClick={() => handleSetStatus(item.key, opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {errorKey?.key === item.key && <p className="pw-save-error">Save failed: {errorKey.message}</p>}
            </>
          ) : (
            <span className="pw-item-status">{STATUS_OPTIONS.find((o) => o.value === item.status)?.label}</span>
          )}
        </div>
      ))}
      <div className="pw-subtotal">
        <span>Overall</span>
        <span>{overallPercent.toFixed(1)}%</span>
      </div>
    </div>
  );
}
