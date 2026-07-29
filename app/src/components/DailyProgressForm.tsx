import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useAssets } from '../lib/useAssets';
import { useWorkItemsConfig } from '../lib/useProjectConfig';

type WorkItemStatus = 'not_started' | 'in_progress' | 'completed';

const STATUS_OPTIONS: { value: WorkItemStatus; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
];

const PERCENT_BY_STATUS: Record<WorkItemStatus, number> = {
  not_started: 0,
  in_progress: 50,
  completed: 100,
};

function statusFromPercent(percent: number): WorkItemStatus {
  if (percent <= 0) return 'not_started';
  if (percent >= 100) return 'completed';
  return 'in_progress';
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

interface DailyProgressFormProps {
  projectId: string;
}

export function DailyProgressForm({ projectId }: DailyProgressFormProps) {
  const { user } = useAuth();
  const { assets, loading: assetsLoading } = useAssets(projectId);
  const { workItems, loading: workItemsLoading } = useWorkItemsConfig(projectId);

  const [assetId, setAssetId] = useState('');
  const [statusByKey, setStatusByKey] = useState<Record<string, WorkItemStatus>>({});
  const [completedToday, setCompletedToday] = useState('');
  const [plannedTomorrow, setPlannedTomorrow] = useState('');
  const [siteAccessStatus, setSiteAccessStatus] = useState('normal');
  const [loadingAsset, setLoadingAsset] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!assetId) return;
    let cancelled = false;
    setLoadingAsset(true);
    setMessage(null);

    Promise.all([
      supabase.from('asset_work_items').select('work_item_key, percent_complete').eq('asset_id', assetId),
      supabase
        .from('asset_daily_log')
        .select('completed_today, planned_tomorrow, site_access_status')
        .eq('asset_id', assetId)
        .eq('log_date', todayIso())
        .maybeSingle(),
    ]).then(([workItemsRes, logRes]) => {
      if (cancelled) return;

      const next: Record<string, WorkItemStatus> = {};
      for (const item of workItemsRes.data ?? []) {
        next[item.work_item_key] = statusFromPercent(Number(item.percent_complete));
      }
      setStatusByKey(next);

      setCompletedToday(logRes.data?.completed_today ?? '');
      setPlannedTomorrow(logRes.data?.planned_tomorrow ?? '');
      setSiteAccessStatus(logRes.data?.site_access_status ?? 'normal');

      setLoadingAsset(false);
    });

    return () => {
      cancelled = true;
    };
  }, [assetId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!assetId || !user) return;
    setSaving(true);
    setMessage(null);

    const workItemRows = workItems.map((item) => {
      const status = statusByKey[item.key] ?? 'not_started';
      return {
        asset_id: assetId,
        work_item_key: item.key,
        percent_complete: PERCENT_BY_STATUS[status],
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : null,
        updated_by: user.id,
      };
    });

    const [workItemsResult, dailyLogResult] = await Promise.all([
      supabase.from('asset_work_items').upsert(workItemRows, { onConflict: 'asset_id,work_item_key' }),
      supabase.from('asset_daily_log').upsert(
        {
          asset_id: assetId,
          log_date: todayIso(),
          completed_today: completedToday,
          planned_tomorrow: plannedTomorrow,
          site_access_status: siteAccessStatus,
          updated_by: user.id,
        },
        { onConflict: 'asset_id,log_date' },
      ),
    ]);

    setSaving(false);

    if (workItemsResult.error || dailyLogResult.error) {
      setMessage(`Save failed: ${workItemsResult.error?.message ?? dailyLogResult.error?.message}`);
      return;
    }

    await supabase.from('activity_log').insert({
      project_id: projectId,
      user_id: user.id,
      action_type: 'daily_progress_update',
      details: { asset_id: assetId, log_date: todayIso() },
    });

    setMessage('Saved.');
  }

  return (
    <form className="progress-form" onSubmit={handleSubmit}>
      <h2>Daily progress entry</h2>

      <label>
        Asset
        <select value={assetId} onChange={(e) => setAssetId(e.target.value)} disabled={assetsLoading}>
          <option value="">Select an asset…</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.asset_code}
              {a.asset_type ? ` — ${a.asset_type}` : ''}
            </option>
          ))}
        </select>
      </label>

      {assetId && loadingAsset && <p>Loading current values…</p>}

      {assetId && !loadingAsset && !workItemsLoading && (
        <>
          <fieldset>
            <legend>Work items</legend>
            {workItems.map((item) => {
              const current = statusByKey[item.key] ?? 'not_started';
              return (
                <div key={item.key} className="work-item-row">
                  <span>
                    {item.label} <span className="work-item-weight">(weight {item.weight})</span>
                  </span>
                  <div className="status-toggle" role="group" aria-label={item.label}>
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`status-btn status-btn-${opt.value}${current === opt.value ? ' active' : ''}`}
                        onClick={() => setStatusByKey((prev) => ({ ...prev, [item.key]: opt.value }))}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </fieldset>

          <label>
            Completed today
            <textarea
              value={completedToday}
              onChange={(e) => setCompletedToday(e.target.value)}
              rows={2}
            />
          </label>

          <label>
            Planned for tomorrow
            <textarea
              value={plannedTomorrow}
              onChange={(e) => setPlannedTomorrow(e.target.value)}
              rows={2}
            />
          </label>

          <label>
            Site access
            <select value={siteAccessStatus} onChange={(e) => setSiteAccessStatus(e.target.value)}>
              <option value="normal">Normal working day</option>
              <option value="restricted">Non-working day — unfavourable weather/terrain</option>
            </select>
          </label>

          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>

          {message && <p className="form-message">{message}</p>}
        </>
      )}
    </form>
  );
}
