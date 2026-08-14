import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useWorkItemsConfig, type WorkItemConfig } from '../lib/useProjectConfig';
import { useAssetPhotos, type AssetPhoto } from '../lib/useAssetPhotos';
import { uploadAssetPhoto } from '../lib/uploadAssetPhoto';

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

const ITEM_STATUS_COLOR: Record<WorkItemStatus, string> = {
  not_started: '#3d4259',
  in_progress: '#00d4aa',
  completed: '#3b82f6',
};

const LOCATION_PHOTO_CATEGORIES = new Set(['location', 'general', 'site']);

function statusFromPercent(percent: number): WorkItemStatus {
  if (percent <= 0) return 'not_started';
  if (percent >= 100) return 'completed';
  return 'in_progress';
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function groupColor(items: WorkItemConfig[], statusByKey: Record<string, WorkItemStatus>): string {
  const statuses = items.map((item) => statusByKey[item.key] ?? 'not_started');
  if (statuses.every((s) => s === 'completed')) return '#3b82f6';
  if (statuses.some((s) => s !== 'not_started')) return '#00d4aa';
  return '#3d4259';
}

function PhotoThumbs({ photos }: { photos: AssetPhoto[] }) {
  return (
    <div className="photo-grid photo-grid-inline">
      {photos.map((p) => (
        <a key={p.id} href={p.file_url} target="_blank" rel="noreferrer" className="photo-thumb">
          <img src={p.file_url} alt="" />
        </a>
      ))}
    </div>
  );
}

interface AssetEditorProps {
  projectId: string;
  assetId: string;
  editable?: boolean;
}

export function AssetEditor({ projectId, assetId, editable = true }: AssetEditorProps) {
  const { user } = useAuth();
  const { workItems, loading: workItemsLoading } = useWorkItemsConfig(projectId);
  const { photos, loading: photosLoading, refresh: refreshPhotos } = useAssetPhotos(assetId);

  const [assetCode, setAssetCode] = useState('');
  const [assetType, setAssetType] = useState<string | null>(null);
  const [station, setStation] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [statusByKey, setStatusByKey] = useState<Record<string, WorkItemStatus>>({});
  const [completedToday, setCompletedToday] = useState('');
  const [plannedTomorrow, setPlannedTomorrow] = useState('');
  const [siteAccessStatus, setSiteAccessStatus] = useState('normal');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [expandedPhotoKey, setExpandedPhotoKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessage(null);

    Promise.all([
      supabase.from('assets').select('asset_code, asset_type, station, notes').eq('id', assetId).maybeSingle(),
      supabase.from('asset_work_items').select('work_item_key, percent_complete').eq('asset_id', assetId),
      supabase
        .from('asset_daily_log')
        .select('completed_today, planned_tomorrow, site_access_status')
        .eq('asset_id', assetId)
        .eq('log_date', todayIso())
        .maybeSingle(),
    ]).then(([assetRes, workItemsRes, logRes]) => {
      if (cancelled) return;

      setAssetCode(assetRes.data?.asset_code ?? '');
      setAssetType(assetRes.data?.asset_type ?? null);
      setStation(assetRes.data?.station ?? null);
      setNotes(assetRes.data?.notes ?? '');

      const next: Record<string, WorkItemStatus> = {};
      for (const item of workItemsRes.data ?? []) {
        next[item.work_item_key] = statusFromPercent(Number(item.percent_complete));
      }
      setStatusByKey(next);

      setCompletedToday(logRes.data?.completed_today ?? '');
      setPlannedTomorrow(logRes.data?.planned_tomorrow ?? '');
      setSiteAccessStatus(logRes.data?.site_access_status ?? 'normal');

      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [assetId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
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

    const [workItemsResult, dailyLogResult, assetResult] = await Promise.all([
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
      supabase.from('assets').update({ notes }).eq('id', assetId),
    ]);

    setSaving(false);

    const firstError = workItemsResult.error ?? dailyLogResult.error ?? assetResult.error;
    if (firstError) {
      setMessage(`Save failed: ${firstError.message}`);
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

  async function handlePhotoUpload(e: ChangeEvent<HTMLInputElement>, category: string) {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;
    setUploadingKey(category);
    setMessage(null);

    try {
      for (const file of Array.from(files)) {
        await uploadAssetPhoto({ projectId, assetCode, assetId, file, uploadedBy: user.id, category });
      }
      await refreshPhotos();
    } catch (err) {
      setMessage(`Photo upload failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploadingKey(null);
      e.target.value = '';
    }
  }

  if (loading) return <p>Loading asset…</p>;

  const groups: { name: string; items: WorkItemConfig[] }[] = [];
  for (const item of workItems) {
    const name = item.group ?? 'Work items';
    let group = groups.find((g) => g.name === name);
    if (!group) {
      group = { name, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }

  const photosByKey: Record<string, AssetPhoto[]> = {};
  const locationPhotos: AssetPhoto[] = [];
  for (const p of photos) {
    if (!p.category || LOCATION_PHOTO_CATEGORIES.has(p.category)) {
      locationPhotos.push(p);
    } else {
      (photosByKey[p.category] ??= []).push(p);
    }
  }

  const isRestricted = siteAccessStatus === 'restricted';

  return (
    <form className="asset-editor" onSubmit={handleSubmit}>
      <h2>
        {assetCode}
        {assetType && <span className="asset-editor-type"> — {assetType}</span>}
        {station != null && <span className="asset-editor-station"> · Sta.{station}m</span>}
      </h2>

      <div className="overall-bar">
        {groups.map((group) => (
          <div
            key={group.name}
            className="overall-seg"
            style={{ flex: group.items.length, background: groupColor(group.items, statusByKey) }}
            title={group.name}
          />
        ))}
      </div>

      {isRestricted ? (
        <div className="access-banner">
          <span className="access-banner-icon">⛔</span>
          <div>
            <div className="access-banner-title">Site Access Restricted</div>
            <div className="access-banner-sub">Non-working day — unfavourable weather/terrain</div>
          </div>
        </div>
      ) : (
        (completedToday || plannedTomorrow) && (
          <div className="daily-cards">
            <div className="daily-card daily-card-today">
              <div className="daily-card-lbl">✅ Today</div>
              <div className="daily-card-val">{completedToday || '—'}</div>
            </div>
            <div className="daily-card daily-card-next">
              <div className="daily-card-lbl">📋 Next day</div>
              <div className="daily-card-val">{plannedTomorrow || '—'}</div>
            </div>
          </div>
        )
      )}

      {!workItemsLoading &&
        groups.map((group) => {
          const color = groupColor(group.items, statusByKey);
          const done = group.items.filter((item) => (statusByKey[item.key] ?? 'not_started') === 'completed')
            .length;
          return (
            <fieldset key={group.name}>
              <legend style={{ color }}>
                {group.name} <span className="group-count">{done}/{group.items.length}</span>
              </legend>
              {group.items.map((item) => {
                const current = statusByKey[item.key] ?? 'not_started';
                const fill = PERCENT_BY_STATUS[current];
                const itemColor = ITEM_STATUS_COLOR[current];
                const itemPhotos = photosByKey[item.key] ?? [];
                const isExpanded = expandedPhotoKey === item.key;

                return (
                  <div key={item.key} className="work-item-row">
                    <div className="task-row">
                      <span className="task-name">{item.label}</span>
                      <div className="task-bar">
                        <div className="task-fill" style={{ width: `${fill}%`, background: itemColor }} />
                      </div>
                      {!editable && (
                        <span className="task-status" style={{ color: itemColor }}>
                          {STATUS_OPTIONS.find((o) => o.value === current)?.label}
                        </span>
                      )}
                      <button
                        type="button"
                        className={`photo-toggle-btn${itemPhotos.length > 0 ? ' has-photos' : ''}`}
                        onClick={() => setExpandedPhotoKey(isExpanded ? null : item.key)}
                        title={`Photos for ${item.label}`}
                      >
                        📷 {itemPhotos.length > 0 ? itemPhotos.length : ''}
                      </button>
                    </div>

                    {editable && (
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
                    )}

                    {isExpanded && (
                      <div className="item-photo-panel">
                        {itemPhotos.length === 0 && <p className="accordion-empty">No photos for {item.label} yet.</p>}
                        <PhotoThumbs photos={itemPhotos} />
                        {editable && (
                          <label className="photo-upload-label photo-upload-label-sm">
                            {uploadingKey === item.key ? 'Uploading…' : `+ Add ${item.label} photo`}
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(e) => handlePhotoUpload(e, item.key)}
                              disabled={uploadingKey === item.key}
                            />
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </fieldset>
          );
        })}

      {editable && (
        <>
          <label>
            Completed today
            <textarea value={completedToday} onChange={(e) => setCompletedToday(e.target.value)} rows={2} />
          </label>

          <label>
            Planned for tomorrow
            <textarea value={plannedTomorrow} onChange={(e) => setPlannedTomorrow(e.target.value)} rows={2} />
          </label>

          <label>
            Site access
            <select value={siteAccessStatus} onChange={(e) => setSiteAccessStatus(e.target.value)}>
              <option value="normal">Normal working day</option>
              <option value="restricted">Non-working day — unfavourable weather/terrain</option>
            </select>
          </label>

          <label>
            Notes
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </label>
        </>
      )}

      {!editable && notes && (
        <p className="readonly-field">
          <strong>Notes:</strong> {notes}
        </p>
      )}

      <fieldset>
        <legend>Location</legend>
        <div className="photo-grid">
          {photosLoading && <p>Loading photos…</p>}
          {!photosLoading && locationPhotos.length === 0 && <p className="readonly-field">No location photos yet.</p>}
          {locationPhotos.map((p) => (
            <a key={p.id} href={p.file_url} target="_blank" rel="noreferrer" className="photo-thumb">
              <img src={p.file_url} alt="" />
            </a>
          ))}
        </div>
        {editable && (
          <label className="photo-upload-label">
            {uploadingKey === 'location' ? 'Uploading…' : '+ Add location photo'}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handlePhotoUpload(e, 'location')}
              disabled={uploadingKey === 'location'}
            />
          </label>
        )}
      </fieldset>

      {editable && (
        <button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      )}

      {message && <p className="form-message">{message}</p>}
    </form>
  );
}
