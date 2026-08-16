import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { updateProjectWorkItem } from '../lib/updateProjectWorkItem';
import type { DesignItemBreakdown } from '../lib/useDesignBreakdown';

interface DesignPanelProps {
  projectId: string;
  projectSlug: string;
  editable: boolean;
  isAdmin: boolean;
  items: DesignItemBreakdown[];
  overallPercent: number;
  loading: boolean;
  onSaved: () => void;
}

export function DesignPanel({
  projectId,
  projectSlug,
  editable,
  isAdmin,
  items,
  overallPercent,
  loading,
  onSaved,
}: DesignPanelProps) {
  const { user } = useAuth();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<{ key: string; message: string } | null>(null);

  useEffect(() => {
    setDrafts(Object.fromEntries(items.map((item) => [item.key, String(item.percentComplete)])));
  }, [items]);

  async function handleSave(itemKey: string) {
    if (!user) return;
    const raw = Number(drafts[itemKey]);
    const percent = Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 0;
    setSavingKey(itemKey);
    setErrorKey(null);
    try {
      await updateProjectWorkItem({
        projectId,
        category: 'design',
        workItemKey: itemKey,
        percentComplete: percent,
        status: percent >= 100 ? 'completed' : percent > 0 ? 'in_progress' : 'not_started',
        updatedBy: user.id,
      });
      onSaved();
      setSavedKey(itemKey);
      setTimeout(() => setSavedKey((k) => (k === itemKey ? null : k)), 1500);
    } catch (err) {
      setErrorKey({ key: itemKey, message: err instanceof Error ? err.message : String(err) });
    } finally {
      setSavingKey(null);
    }
  }

  const editItemsLink = isAdmin && (
    <Link to={`/admin/${projectSlug}/design-items`} className="pw-edit-items-link">
      Edit items
    </Link>
  );

  if (loading) return <p className="accordion-empty">Loading…</p>;
  if (items.length === 0) {
    return (
      <div className="pw-item-list">
        <p className="accordion-empty">No design items configured for this project.</p>
        {editItemsLink}
      </div>
    );
  }

  return (
    <div className="pw-item-list">
      {editItemsLink}
      {items.map((item) => (
        <div key={item.key} className="pw-item-row">
          <span className="pw-item-label">{item.label}</span>
          {editable ? (
            <div className="pw-percent-input-wrap">
              <div className="pw-percent-input">
                {savingKey === item.key && <span className="pw-save-indicator">Saving…</span>}
                {savedKey === item.key && <span className="pw-save-indicator pw-save-ok">✓ Saved</span>}
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={drafts[item.key] ?? ''}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [item.key]: e.target.value }))}
                  onBlur={() => handleSave(item.key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  disabled={savingKey === item.key}
                />
                <span>%</span>
              </div>
              {errorKey?.key === item.key && <p className="pw-save-error">Save failed: {errorKey.message}</p>}
            </div>
          ) : (
            <span className="pw-item-percent">{item.percentComplete.toFixed(1)}%</span>
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
