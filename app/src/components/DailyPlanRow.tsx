import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { usePlanForToday } from '../lib/usePlanForToday';
import { usePlannedTomorrow, addPlannedActivity, removePlannedActivity } from '../lib/usePlannedTomorrow';
import type { AssetListItem } from '../lib/useAssets';
import type { WorkItemConfig } from '../lib/useProjectConfig';

interface DailyPlanRowProps {
  projectId: string;
  assets: AssetListItem[];
  workItems: WorkItemConfig[];
  editable: boolean;
}

type Tab = 'today' | 'tomorrow' | null;

export function DailyPlanRow({ projectId, assets, workItems, editable }: DailyPlanRowProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>(null);
  const { entries: todayEntries, loading: todayLoading } = usePlanForToday(projectId);
  const { entries: tomorrowEntries, loading: tomorrowLoading, refresh: refreshTomorrow } = usePlannedTomorrow(projectId);
  const [pickAsset, setPickAsset] = useState('');
  const [pickWorkItem, setPickWorkItem] = useState('');
  const [adding, setAdding] = useState(false);

  function labelFor(key: string) {
    return workItems.find((w) => w.key === key)?.label ?? key;
  }

  function toggle(tab: Tab) {
    setActiveTab((prev) => (prev === tab ? null : tab));
  }

  async function handleAdd() {
    if (!pickAsset || !pickWorkItem || !user) return;
    setAdding(true);
    try {
      await addPlannedActivity(pickAsset, pickWorkItem, user.id);
      setPickAsset('');
      setPickWorkItem('');
      await refreshTomorrow();
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id: string) {
    await removePlannedActivity(id);
    await refreshTomorrow();
  }

  const completedToday = todayEntries.filter((e) => e.kind === 'completed');
  const ongoingToday = todayEntries.filter((e) => e.kind === 'ongoing');

  return (
    <div className="daily-plan-row">
      <div className="daily-plan-tabs">
        <button
          type="button"
          className={`daily-plan-tab${activeTab === 'today' ? ' active' : ''}`}
          onClick={() => toggle('today')}
        >
          Plan for Today <span className="daily-plan-tab-count">{todayEntries.length}</span>
        </button>
        <button
          type="button"
          className={`daily-plan-tab${activeTab === 'tomorrow' ? ' active' : ''}`}
          onClick={() => toggle('tomorrow')}
        >
          Plan for Tomorrow <span className="daily-plan-tab-count">{tomorrowEntries.length}</span>
        </button>
      </div>

      {activeTab === 'today' && (
        <div className="daily-plan-detail">
          {todayLoading && <p className="accordion-empty">Loading…</p>}
          {!todayLoading && todayEntries.length === 0 && (
            <p className="accordion-empty">Nothing completed or ongoing today.</p>
          )}
          {completedToday.length > 0 && (
            <div className="daily-plan-group">
              <div className="daily-plan-group-title">✅ Completed today</div>
              {completedToday.map((e, i) => (
                <div key={i} className="daily-plan-row-item">
                  <span className="daily-plan-tower">{e.assetCode}</span>
                  <span className="daily-plan-activity">{labelFor(e.workItemKey)}</span>
                </div>
              ))}
            </div>
          )}
          {ongoingToday.length > 0 && (
            <div className="daily-plan-group">
              <div className="daily-plan-group-title">🔧 Ongoing</div>
              {ongoingToday.map((e, i) => (
                <div key={i} className="daily-plan-row-item">
                  <span className="daily-plan-tower">{e.assetCode}</span>
                  <span className="daily-plan-activity">{labelFor(e.workItemKey)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'tomorrow' && (
        <div className="daily-plan-detail">
          {tomorrowLoading && <p className="accordion-empty">Loading…</p>}
          {!tomorrowLoading && tomorrowEntries.length === 0 && (
            <p className="accordion-empty">Nothing planned for tomorrow yet.</p>
          )}
          {tomorrowEntries.map((e) => (
            <div key={e.id} className="daily-plan-row-item">
              <span className="daily-plan-tower">{e.assetCode}</span>
              <span className="daily-plan-activity">{labelFor(e.workItemKey)}</span>
              {editable && (
                <button
                  type="button"
                  className="items-editor-remove-btn"
                  onClick={() => handleRemove(e.id)}
                  title="Remove"
                >
                  ×
                </button>
              )}
            </div>
          ))}

          {editable && (
            <div className="daily-plan-add-row">
              <select value={pickAsset} onChange={(e) => setPickAsset(e.target.value)}>
                <option value="">Tower…</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.asset_code}
                  </option>
                ))}
              </select>
              <select value={pickWorkItem} onChange={(e) => setPickWorkItem(e.target.value)}>
                <option value="">Activity…</option>
                {workItems.map((w) => (
                  <option key={w.key} value={w.key}>
                    {w.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="doc-form-btn"
                onClick={handleAdd}
                disabled={adding || !pickAsset || !pickWorkItem}
              >
                {adding ? '…' : 'Add'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
