import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import type { SupplyItemBreakdown } from '../lib/useSupplyBreakdown';
import { updateProjectWorkItem } from '../lib/updateProjectWorkItem';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { SUPPLY_STAGES, STAGE_META, stageLabel } from '../lib/supplyStatus';
import { TOWER_SUPPLY_KEYS, type useSupplyFromTowers } from '../lib/useSupplyFromTowers';

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
  /** Items whose percentages come from the per-tower material status instead of manual input. */
  computedKeys?: string[];
  towerSupply?: ReturnType<typeof useSupplyFromTowers>;
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
  computedKeys = [],
  towerSupply,
}: SupplyPanelProps) {
  const { user } = useAuth();
  const { t, tLabel, n, language } = useLanguage();
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
      {t('common.editItems')}
    </Link>
  );

  if (loading) return <p className="accordion-empty">{t('common.loading')}</p>;
  if (items.length === 0) {
    return (
      <div className="pw-item-list">
        <p className="accordion-empty">{t('progress.noSupplyItems')}</p>
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
              <span className="pw-item-label">{tLabel(item.label)}</span>
              <span className="pw-item-percent">{n(item.percentComplete.toFixed(1))}%</span>
            </div>
            {computedKeys.includes(item.key) && towerSupply ? (
              <div className="pw-supply-computed">
                <div className="pw-supply-chips">
                  {SUPPLY_STAGES.map((st) => {
                    const totals = item.key === TOWER_SUPPLY_KEYS.stub ? towerSupply.stubs : towerSupply.towers;
                    const count = totals.counts[st];
                    if (!count) return null;
                    return (
                      <span key={st} className="pw-supply-chip" style={{ borderColor: STAGE_META[st].color }}>
                        <i style={{ background: STAGE_META[st].color }} />
                        {stageLabel(st, language)} {n(String(count))}
                      </span>
                    );
                  })}
                </div>
                <span className="pw-item-status">
                  {t('progress.manufactured')} {n(item.manufacturedPercent.toFixed(0))}% · {t('progress.delivered')} {n(item.deliveredPercent.toFixed(0))}%
                  {language === 'tr' ? ' — direk bazında hesaplandı (ağırlık)' : ' — computed per tower (by weight)'}
                </span>
              </div>
            ) : editable ? (
              <div className="pw-supply-stages">
                <label className="pw-supply-stage">
                  <span>{t('progress.manufactured')}</span>
                  <div className="pw-percent-input">
                    {savingKey === mfgKey && <span className="pw-save-indicator">{t('common.saving')}</span>}
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
                  <span>{t('progress.delivered')}</span>
                  <div className="pw-percent-input">
                    {savingKey === delKey && <span className="pw-save-indicator">{t('common.saving')}</span>}
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
                  <p className="pw-save-error">{t('common.saveFailed', { message: errorKey.message })}</p>
                )}
              </div>
            ) : (
              <span className="pw-item-status">
                {t('progress.manufactured')} {n(item.manufacturedPercent.toFixed(0))}% · {t('progress.delivered')}{' '}
                {n(item.deliveredPercent.toFixed(0))}%
              </span>
            )}
          </div>
        );
      })}
      <div className="pw-subtotal">
        <span>{t('common.overall')}</span>
        <span>{n(overallPercent.toFixed(1))}%</span>
      </div>
    </div>
  );
}
