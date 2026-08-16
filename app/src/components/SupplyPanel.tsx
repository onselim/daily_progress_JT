import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import type { SupplyItemBreakdown } from '../lib/useSupplyBreakdown';
import { updateProjectWorkItem } from '../lib/updateProjectWorkItem';

type Stage = 'mfg' | 'del';

interface SupplyPanelProps {
  projectId: string;
  projectSlug: string;
  editable: boolean;
  isAdmin: boolean;
  items: SupplyItemBreakdown[];
  overallPercent: number;
  loading: boolean;
  onSaved: () => void;
}

export function SupplyPanel({
  projectId,
  projectSlug,
  editable,
  isAdmin,
  items,
  overallPercent,
  loading,
  onSaved,
}: SupplyPanelProps) {
  const { user } = useAuth();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<{ key: string; message: string } | null>(null);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const item of items) {
      next[`${item.key}__mfg`] = String(item.manufacturedPercent);
      next[`${item.key}__del`] = String(item.deliveredPercent);
    }
    setDrafts(next);
  }, [items]);

  async function handleSave(itemKey: string, stage: Stage) {
    if (!user) return;
    const draftKey = `${itemKey}__${stage}`;
    const raw = Number(drafts[draftKey]);
    const percent = Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 0;
    setSavingKey(draftKey);
    setErrorKey(null);
    try {
      await updateProjectWorkItem({
        projectId,
        category: 'supply',
        workItemKey: draftKey,
        percentComplete: percent,
        status: percent >= 100 ? 'completed' : percent > 0 ? 'in_progress' : 'not_started',
        updatedBy: user.id,
      });
      onSaved();
      setSavedKey(draftKey);
      setTimeout(() => setSavedKey((k) => (k === draftKey ? null : k)), 1500);
    } catch (err) {
      setErrorKey({ key: draftKey, message: err instanceof Error ? err.message : String(err) });
    } finally {
      setSavingKey(null);
    }
  }

  const editItemsLink = isAdmin && (
    <Link to={`/admin/${projectSlug}/supply-items`} className="pw-edit-items-link">
      Edit items
    </Link>
  );

  if (loading) return <p className="accordion-empty">Loading…</p>;
  if (items.length === 0) {
    return (
      <div className="pw-item-list">
        <p className="accordion-empty">No supply items configured for this project.</p>
        {editItemsLink}
      </div>
    );
  }

  return (
    <div className="pw-item-list">
      {editItemsLink}
      {items.map((item) => {
        const mfgKey = `${item.key}__mfg`;
        const delKey = `${item.key}__del`;
        return (
          <div key={item.key} className="pw-item-row pw-item-row-col">
            <div className="pw-item-row">
              <span className="pw-item-label">{item.label}</span>
              <span className="pw-item-percent">{item.percentComplete.toFixed(1)}%</span>
            </div>
            {editable ? (
              <div className="pw-supply-stages">
                <label className="pw-supply-stage">
                  <span>Manufactured (2/3)</span>
                  <div className="pw-percent-input">
                    {savingKey === mfgKey && <span className="pw-save-indicator">Saving…</span>}
                    {savedKey === mfgKey && <span className="pw-save-indicator pw-save-ok">✓</span>}
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={drafts[mfgKey] ?? ''}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [mfgKey]: e.target.value }))}
                      onBlur={() => handleSave(item.key, 'mfg')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                      disabled={savingKey === mfgKey}
                    />
                    <span>%</span>
                  </div>
                </label>
                <label className="pw-supply-stage">
                  <span>Delivered (1/3)</span>
                  <div className="pw-percent-input">
                    {savingKey === delKey && <span className="pw-save-indicator">Saving…</span>}
                    {savedKey === delKey && <span className="pw-save-indicator pw-save-ok">✓</span>}
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={drafts[delKey] ?? ''}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [delKey]: e.target.value }))}
                      onBlur={() => handleSave(item.key, 'del')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                      disabled={savingKey === delKey}
                    />
                    <span>%</span>
                  </div>
                </label>
                {(errorKey?.key === mfgKey || errorKey?.key === delKey) && (
                  <p className="pw-save-error">Save failed: {errorKey.message}</p>
                )}
              </div>
            ) : (
              <span className="pw-item-status">
                Manufactured {item.manufacturedPercent.toFixed(0)}% · Delivered {item.deliveredPercent.toFixed(0)}%
              </span>
            )}
          </div>
        );
      })}
      <div className="pw-subtotal">
        <span>Overall</span>
        <span>{overallPercent.toFixed(1)}%</span>
      </div>
    </div>
  );
}
