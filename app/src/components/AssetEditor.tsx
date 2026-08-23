import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useWorkItemsConfig, type WorkItemConfig } from '../lib/useProjectConfig';
import { useFoundationTypesConfig, getFoundationTypeForAsset } from '../lib/useFoundationTypesConfig';
import { useAssetPhotos, type AssetPhoto } from '../lib/useAssetPhotos';
import { uploadAssetPhoto } from '../lib/uploadAssetPhoto';
import { deleteAssetPhoto } from '../lib/deleteAssetPhoto';
import { useAssetDocuments, type AssetDocument } from '../lib/useAssetDocuments';
import { uploadAssetDocument } from '../lib/uploadAssetDocument';
import { deleteAssetDocument } from '../lib/deleteAssetDocument';
import { renameAssetDocument } from '../lib/renameDocument';
import { RenamableText } from './RenamableText';
import { WindyPopup } from './WindyPopup';
import { utmToLatLng } from '../lib/utmToLatLng';

type WorkItemStatus = 'not_started' | 'in_progress' | 'completed';

// Work items that get a per-tower test-report/certificate upload (in addition to photos),
// per the client's "Menu eklemeleri" spec: Soil Investigation Report, Concrete Test Cube
// results, Backfill test results, Earthing measurement results.
const DOCUMENT_ENABLED_KEYS: Record<string, string> = {
  si_sw: 'Soil Investigation Report',
  fn_co: 'Concrete Test Cube results',
  fn_bf: 'Backfill test results',
  er_te: 'Earthing measurement results',
};

const STATUS_OPTIONS: { value: WorkItemStatus; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
];

const RESTRICTION_REASONS: { value: string; label: string }[] = [
  { value: 'not_approved', label: 'Not approved' },
  { value: 'no_permit', label: 'No Permit' },
  { value: 'no_access', label: 'No Access' },
  { value: 'land_owner_problem', label: 'Land Owner Problem' },
  { value: 'other', label: 'Other' },
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

function PhotoThumbs({
  photos,
  editable,
  deletingIds,
  onDelete,
  inline,
}: {
  photos: AssetPhoto[];
  editable: boolean;
  deletingIds: Set<string>;
  onDelete: (photo: AssetPhoto) => void;
  inline?: boolean;
}) {
  return (
    <div className={`photo-grid${inline ? ' photo-grid-inline' : ''}`}>
      {photos.map((p) => (
        <div key={p.id} className="photo-thumb-wrap">
          <a href={p.file_url} target="_blank" rel="noreferrer" className="photo-thumb">
            <img src={p.file_url} alt="" />
          </a>
          {editable && (
            <button
              type="button"
              className="photo-delete-btn"
              disabled={deletingIds.has(p.id)}
              onClick={() => onDelete(p)}
              title="Delete photo"
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function DocumentLinks({
  documents,
  editable,
  deletingIds,
  onDelete,
  onRename,
}: {
  documents: AssetDocument[];
  editable: boolean;
  deletingIds: Set<string>;
  onDelete: (doc: AssetDocument) => void;
  onRename: (doc: AssetDocument, newName: string) => void;
}) {
  return (
    <div className="doc-folder-body">
      {documents.map((d) => (
        <div key={d.id} className="doc-row">
          <RenamableText value={d.file_name} editable={editable} onRename={(name) => onRename(d, name)}>
            <a href={d.file_url} target="_blank" rel="noreferrer">
              {d.file_name}
            </a>
          </RenamableText>
          {editable && (
            <button
              type="button"
              className="items-editor-remove-btn"
              disabled={deletingIds.has(d.id)}
              onClick={() => onDelete(d)}
              title="Delete document"
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

interface AssetEditorProps {
  projectId: string;
  assetId: string;
  coordinateSystem?: string | null;
  editable?: boolean;
  onSaved?: () => void;
}

export function AssetEditor({ projectId, assetId, coordinateSystem = null, editable = true, onSaved }: AssetEditorProps) {
  const { user } = useAuth();
  const { workItems, loading: workItemsLoading } = useWorkItemsConfig(projectId);
  const { foundationTypes } = useFoundationTypesConfig(projectId);
  const { photos, loading: photosLoading, refresh: refreshPhotos } = useAssetPhotos(assetId);
  const { documents: assetDocs, refresh: refreshAssetDocs } = useAssetDocuments(assetId);

  const [assetCode, setAssetCode] = useState('');
  const [assetType, setAssetType] = useState<string | null>(null);
  const [station, setStation] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [assetLatLng, setAssetLatLng] = useState<[number, number] | null>(null);
  const [legExtM, setLegExtM] = useState<(number | null)[] | null>(null);
  const [soilType, setSoilType] = useState<number | null>(null);
  const [showWindy, setShowWindy] = useState(false);
  const [statusByKey, setStatusByKey] = useState<Record<string, WorkItemStatus>>({});
  const [completedDateByKey, setCompletedDateByKey] = useState<Record<string, string>>({});
  const [quantityPercentByKey, setQuantityPercentByKey] = useState<Record<string, number>>({});
  const [siteAccessStatus, setSiteAccessStatus] = useState('normal');
  const [restrictionReason, setRestrictionReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [expandedPhotoKey, setExpandedPhotoKey] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [expandedDocKey, setExpandedDocKey] = useState<string | null>(null);
  const [uploadingDocKey, setUploadingDocKey] = useState<string | null>(null);
  const [deletingDocIds, setDeletingDocIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessage(null);

    Promise.all([
      supabase
        .from('assets')
        .select(
          'asset_code, asset_type, station, notes, lat, lng, x, y, leg1_ext_m, leg2_ext_m, leg3_ext_m, leg4_ext_m, soil_type',
        )
        .eq('id', assetId)
        .maybeSingle(),
      supabase
        .from('asset_work_items')
        .select('work_item_key, percent_complete, completed_at, quantity_percent')
        .eq('asset_id', assetId),
      supabase
        .from('asset_daily_log')
        .select('site_access_status, restriction_reason')
        .eq('asset_id', assetId)
        .eq('log_date', todayIso())
        .maybeSingle(),
    ]).then(([assetRes, workItemsRes, logRes]) => {
      if (cancelled) return;

      setAssetCode(assetRes.data?.asset_code ?? '');
      setAssetType(assetRes.data?.asset_type ?? null);
      setStation(assetRes.data?.station ?? null);
      setNotes(assetRes.data?.notes ?? '');
      const legs = [
        assetRes.data?.leg1_ext_m,
        assetRes.data?.leg2_ext_m,
        assetRes.data?.leg3_ext_m,
        assetRes.data?.leg4_ext_m,
      ];
      setLegExtM(legs.every((v) => v == null) ? null : legs.map((v) => (v == null ? null : Number(v))));
      setSoilType(assetRes.data?.soil_type != null ? Number(assetRes.data.soil_type) : null);

      const rawLat = assetRes.data?.lat;
      const rawLng = assetRes.data?.lng;
      if (rawLat != null && rawLng != null) {
        setAssetLatLng([rawLat, rawLng]);
      } else if (assetRes.data?.x != null && assetRes.data?.y != null && coordinateSystem) {
        try {
          setAssetLatLng(utmToLatLng(assetRes.data.x, assetRes.data.y, coordinateSystem));
        } catch {
          setAssetLatLng(null);
        }
      } else {
        setAssetLatLng(null);
      }

      const next: Record<string, WorkItemStatus> = {};
      const nextDates: Record<string, string> = {};
      const nextQtyPercent: Record<string, number> = {};
      for (const item of workItemsRes.data ?? []) {
        next[item.work_item_key] = statusFromPercent(Number(item.percent_complete));
        if (item.completed_at) nextDates[item.work_item_key] = item.completed_at.slice(0, 10);
        nextQtyPercent[item.work_item_key] = Number(item.quantity_percent ?? 100);
      }
      setStatusByKey(next);
      setCompletedDateByKey(nextDates);
      setQuantityPercentByKey(nextQtyPercent);

      setSiteAccessStatus(logRes.data?.site_access_status ?? 'normal');
      setRestrictionReason(logRes.data?.restriction_reason ?? '');

      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [assetId, coordinateSystem]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage(null);

    const workItemRows = workItems.map((item) => {
      const status = statusByKey[item.key] ?? 'not_started';
      const completedDate = completedDateByKey[item.key] || todayIso();
      return {
        asset_id: assetId,
        work_item_key: item.key,
        percent_complete: PERCENT_BY_STATUS[status],
        status,
        completed_at: status === 'completed' ? new Date(`${completedDate}T12:00:00Z`).toISOString() : null,
        quantity_percent: quantityPercentByKey[item.key] ?? 100,
        updated_by: user.id,
      };
    });

    const [workItemsResult, dailyLogResult, assetResult] = await Promise.all([
      supabase.from('asset_work_items').upsert(workItemRows, { onConflict: 'asset_id,work_item_key' }),
      supabase.from('asset_daily_log').upsert(
        {
          asset_id: assetId,
          log_date: todayIso(),
          site_access_status: siteAccessStatus,
          restriction_reason: siteAccessStatus === 'restricted' ? restrictionReason || null : null,
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
    onSaved?.();
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

  async function handleDeletePhoto(photo: AssetPhoto) {
    setDeletingIds((prev) => new Set(prev).add(photo.id));
    setMessage(null);
    try {
      await deleteAssetPhoto(photo.id, photo.file_url);
      await refreshPhotos();
    } catch (err) {
      setMessage(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(photo.id);
        return next;
      });
    }
  }

  async function handleDocumentUpload(e: ChangeEvent<HTMLInputElement>, workItemKey: string) {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;
    setUploadingDocKey(workItemKey);
    setMessage(null);

    try {
      for (const file of Array.from(files)) {
        await uploadAssetDocument({ projectId, assetCode, assetId, file, uploadedBy: user.id, workItemKey });
      }
      await refreshAssetDocs();
    } catch (err) {
      setMessage(`Document upload failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploadingDocKey(null);
      e.target.value = '';
    }
  }

  async function handleRenameDocument(doc: AssetDocument, newName: string) {
    try {
      await renameAssetDocument(doc.id, newName);
      await refreshAssetDocs();
    } catch (err) {
      setMessage(`Rename failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleDeleteDocument(doc: AssetDocument) {
    setDeletingDocIds((prev) => new Set(prev).add(doc.id));
    setMessage(null);
    try {
      await deleteAssetDocument(doc.id, doc.file_url);
      await refreshAssetDocs();
    } catch (err) {
      setMessage(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDeletingDocIds((prev) => {
        const next = new Set(prev);
        next.delete(doc.id);
        return next;
      });
    }
  }

  if (loading) return <p>Loading asset…</p>;

  // Work items form one strict pipeline in the project's canonical order (Pre-Construction
  // -> Foundation -> Erection -> Stringing, and sequential within each group too, e.g.
  // Excavation before Lean Concrete, Ground Erection before Tower Erection). An item can't
  // move past "Not started" until the item immediately before it is Completed.
  function lockInfo(key: string): { locked: boolean; blockingLabel?: string } {
    const idx = workItems.findIndex((w) => w.key === key);
    if (idx <= 0) return { locked: false };
    const prev = workItems[idx - 1];
    const prevStatus = statusByKey[prev.key] ?? 'not_started';
    return prevStatus === 'completed' ? { locked: false } : { locked: true, blockingLabel: prev.label };
  }

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
  const foundation = getFoundationTypeForAsset(assetType, foundationTypes);

  return (
    <form className="asset-editor" onSubmit={handleSubmit}>
      <h2>
        {assetCode}
        {assetType && <span className="asset-editor-type"> — {assetType}</span>}
        {station != null && <span className="asset-editor-station"> · Sta.{station}m</span>}
        {assetLatLng && (
          <button
            type="button"
            className="wind-toggle-btn"
            onClick={() => setShowWindy((v) => !v)}
            title="Wind forecast"
          >
            🌬
          </button>
        )}
      </h2>

      {showWindy && assetLatLng && (
        <WindyPopup
          lat={assetLatLng[0]}
          lng={assetLatLng[1]}
          label={assetCode}
          onClose={() => setShowWindy(false)}
        />
      )}

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

      {isRestricted && (
        <div className="access-banner">
          <span className="access-banner-icon">⛔</span>
          <div>
            <div className="access-banner-title">Site Access Restricted</div>
            <div className="access-banner-sub">
              {RESTRICTION_REASONS.find((r) => r.value === restrictionReason)?.label ?? 'Reason not set'}
            </div>
          </div>
        </div>
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
              {group.name.toUpperCase() === 'FOUNDATION' && foundation && (
                <div className="foundation-stats" title={`${foundation.type} — ${foundation.soilType}`}>
                  <div className="foundation-stat">
                    <span className="foundation-stat-label">Concrete</span>
                    <span className="foundation-stat-value">{foundation.concreteM3.toFixed(2)} m³</span>
                  </div>
                  <div className="foundation-stat">
                    <span className="foundation-stat-label">Excavation</span>
                    <span className="foundation-stat-value">{foundation.excavationM3.toFixed(1)} m³</span>
                  </div>
                  <div className="foundation-stat">
                    <span className="foundation-stat-label">Reinforcement</span>
                    <span className="foundation-stat-value">{foundation.reinforcementKg.toLocaleString()} kg</span>
                  </div>
                  <div className="foundation-stat">
                    <span className="foundation-stat-label">Lean Concrete</span>
                    <span className="foundation-stat-value">{foundation.leanConcreteM3.toFixed(2)} m³</span>
                  </div>
                </div>
              )}
              {group.name.toUpperCase() === 'FOUNDATION' && (legExtM || soilType != null) && (
                <div className="foundation-stub-row" title="Per-leg extension and soil type, used for the excavation-pit layer">
                  {soilType != null && <span>Soil Type {soilType}</span>}
                  {legExtM && (
                    <span>
                      Leg Ext (m):{' '}
                      {legExtM
                        .map((v, i) => `L${i + 1} ${v == null ? '—' : v > 0 ? `+${v}` : v}`)
                        .join(' · ')}
                    </span>
                  )}
                </div>
              )}
              {group.items.map((item) => {
                const current = statusByKey[item.key] ?? 'not_started';
                const fill = PERCENT_BY_STATUS[current];
                const itemColor = ITEM_STATUS_COLOR[current];
                const itemPhotos = photosByKey[item.key] ?? [];
                const isExpanded = expandedPhotoKey === item.key;
                const docLabel = DOCUMENT_ENABLED_KEYS[item.key];
                const itemDocs = docLabel ? assetDocs.filter((d) => d.work_item_key === item.key) : [];
                const isDocExpanded = expandedDocKey === item.key;
                const { locked, blockingLabel } = lockInfo(item.key);
                const isFoundationItem = group.name.toUpperCase() === 'FOUNDATION';
                const qtyPercent = quantityPercentByKey[item.key] ?? 100;

                return (
                  <div key={item.key} className="work-item-row">
                    <div className="task-row">
                      <span className="task-name">
                        {locked && (
                          <span className="task-lock-icon" title={`Complete "${blockingLabel}" first`}>
                            🔒
                          </span>
                        )}
                        {item.label}
                      </span>
                      <div className="task-bar">
                        <div className="task-fill" style={{ width: `${fill}%`, background: itemColor }} />
                      </div>
                      {!editable && (
                        <span className="task-status" style={{ color: itemColor }}>
                          {STATUS_OPTIONS.find((o) => o.value === current)?.label}
                          {current === 'completed' && completedDateByKey[item.key] && (
                            <span className="completed-date-stamp completed-date-stamp-inline">
                              {completedDateByKey[item.key]}
                            </span>
                          )}
                          {isFoundationItem && current !== 'not_started' && qtyPercent !== 100 && (
                            <span className="qty-percent-badge" title="Share of designed quantity actually placed">
                              {qtyPercent}% qty
                            </span>
                          )}
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
                      {docLabel && (
                        <button
                          type="button"
                          className={`photo-toggle-btn${itemDocs.length > 0 ? ' has-photos' : ''}`}
                          onClick={() => setExpandedDocKey(isDocExpanded ? null : item.key)}
                          title={docLabel}
                        >
                          📄 {itemDocs.length > 0 ? itemDocs.length : ''}
                        </button>
                      )}
                    </div>

                    {editable && (
                      <div className="status-toggle" role="group" aria-label={item.label}>
                        {STATUS_OPTIONS.map((opt) => {
                          const blockedByLock = locked && opt.value !== 'not_started' && current !== opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              className={`status-btn status-btn-${opt.value}${current === opt.value ? ' active' : ''}`}
                              disabled={blockedByLock}
                              title={blockedByLock ? `Complete "${blockingLabel}" first` : undefined}
                              onClick={() => {
                                setStatusByKey((prev) => ({ ...prev, [item.key]: opt.value }));
                                if (opt.value === 'completed' && !completedDateByKey[item.key]) {
                                  setCompletedDateByKey((prev) => ({ ...prev, [item.key]: todayIso() }));
                                }
                              }}
                            >
                              {opt.label}
                              {opt.value === 'completed' && current === 'completed' && completedDateByKey[item.key] && (
                                <span className="completed-date-stamp">{completedDateByKey[item.key]}</span>
                              )}
                            </button>
                          );
                        })}
                        {current === 'completed' && (
                          <input
                            type="date"
                            className="completed-date-input"
                            value={completedDateByKey[item.key] ?? todayIso()}
                            onChange={(e) =>
                              setCompletedDateByKey((prev) => ({ ...prev, [item.key]: e.target.value }))
                            }
                          />
                        )}
                        {isFoundationItem && current !== 'not_started' && (
                          <label
                            className="qty-percent-field"
                            title="Share of the designed quantity actually placed -- e.g. only 2 of 4 legs poured, or pad-only on a pad-and-chimney foundation"
                          >
                            Qty
                            <input
                              type="number"
                              className="qty-percent-input"
                              min={0}
                              max={100}
                              step={5}
                              value={qtyPercent}
                              onChange={(e) => {
                                const raw = Number(e.target.value);
                                const clamped = Number.isNaN(raw) ? 100 : Math.min(100, Math.max(0, raw));
                                setQuantityPercentByKey((prev) => ({ ...prev, [item.key]: clamped }));
                              }}
                            />
                            %
                          </label>
                        )}
                      </div>
                    )}

                    {isExpanded && (
                      <div className="item-photo-panel">
                        {itemPhotos.length === 0 && <p className="accordion-empty">No photos for {item.label} yet.</p>}
                        <PhotoThumbs
                          photos={itemPhotos}
                          editable={editable}
                          deletingIds={deletingIds}
                          onDelete={handleDeletePhoto}
                          inline
                        />
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

                    {docLabel && isDocExpanded && (
                      <div className="item-photo-panel">
                        {itemDocs.length === 0 && <p className="accordion-empty">No {docLabel} uploaded yet.</p>}
                        <DocumentLinks
                          documents={itemDocs}
                          editable={editable}
                          deletingIds={deletingDocIds}
                          onDelete={handleDeleteDocument}
                          onRename={handleRenameDocument}
                        />
                        {editable && (
                          <label className="photo-upload-label photo-upload-label-sm">
                            {uploadingDocKey === item.key ? 'Uploading…' : `+ Add ${docLabel}`}
                            <input
                              type="file"
                              multiple
                              onChange={(e) => handleDocumentUpload(e, item.key)}
                              disabled={uploadingDocKey === item.key}
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
            Site access
            <div className="status-toggle site-access-toggle" role="group" aria-label="Site access">
              <button
                type="button"
                className={`status-btn status-btn-workable${siteAccessStatus === 'normal' ? ' active' : ''}`}
                onClick={() => {
                  setSiteAccessStatus('normal');
                  setRestrictionReason('');
                }}
              >
                Workable
              </button>
              <button
                type="button"
                className={`status-btn status-btn-restricted${siteAccessStatus === 'restricted' ? ' active' : ''}`}
                onClick={() => setSiteAccessStatus('restricted')}
              >
                Restricted
              </button>
            </div>
          </label>

          {siteAccessStatus === 'restricted' && (
            <label>
              Restriction reason
              <select value={restrictionReason} onChange={(e) => setRestrictionReason(e.target.value)}>
                <option value="">— select —</option>
                {RESTRICTION_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          )}

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
        {photosLoading && <p>Loading photos…</p>}
        {!photosLoading && locationPhotos.length === 0 && <p className="readonly-field">No location photos yet.</p>}
        <PhotoThumbs
          photos={locationPhotos}
          editable={editable}
          deletingIds={deletingIds}
          onDelete={handleDeletePhoto}
        />
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
