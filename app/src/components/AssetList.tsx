import { useState } from 'react';
import { useAssets } from '../lib/useAssets';
import type { WorkItemConfig } from '../lib/useProjectConfig';

const STATUS_COLOR: Record<string, string> = {
  not_started: '#3d4259',
  in_progress: '#00d4aa',
  completed: '#3b82f6',
  on_hold: '#ef4444',
};

function groupSegments(
  workItems: WorkItemConfig[],
  percentByKey: Record<string, number> | undefined,
): { name: string; total: number; color: string }[] {
  const groups: { name: string; total: number; done: number; active: number }[] = [];
  for (const item of workItems) {
    const name = item.group ?? 'Work items';
    let group = groups.find((g) => g.name === name);
    if (!group) {
      group = { name, total: 0, done: 0, active: 0 };
      groups.push(group);
    }
    group.total += 1;
    const pct = percentByKey?.[item.key] ?? 0;
    if (pct >= 100) group.done += 1;
    else if (pct > 0) group.active += 1;
  }
  return groups.map((g) => ({
    name: g.name,
    total: g.total,
    color: g.done === g.total ? '#3b82f6' : g.active > 0 || g.done > 0 ? '#00d4aa' : '#3d4259',
  }));
}

interface AssetListProps {
  projectId: string;
  selectedAssetId: string;
  onSelect: (assetId: string) => void;
  progressByAsset: Record<string, number>;
  percentByAssetAndKey: Record<string, Record<string, number>>;
  workItems: WorkItemConfig[];
  restrictedAssetIds: Set<string>;
}

export function AssetList({
  projectId,
  selectedAssetId,
  onSelect,
  progressByAsset,
  percentByAssetAndKey,
  workItems,
  restrictedAssetIds,
}: AssetListProps) {
  const { assets, loading } = useAssets(projectId);
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? assets.filter((a) => a.asset_code.toLowerCase().includes(search.trim().toLowerCase()))
    : assets;

  return (
    <div className="asset-list-panel">
      <input
        type="search"
        placeholder="Search asset code…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="asset-search"
      />
      {loading && <p>Loading assets…</p>}
      <ul className="asset-list">
        {filtered.map((a) => {
          const pct = progressByAsset[a.id] ?? 0;
          const restricted = restrictedAssetIds.has(a.id);
          const numColor = restricted ? '#ef4444' : STATUS_COLOR[a.status];
          const segments = groupSegments(workItems, percentByAssetAndKey[a.id]);
          return (
            <li key={a.id}>
              <button
                type="button"
                className={`asset-list-item${a.id === selectedAssetId ? ' active' : ''}`}
                onClick={() => onSelect(a.id)}
              >
                <div className="asset-list-item-row">
                  <span className="asset-num" style={{ color: numColor }}>
                    {a.asset_code}
                  </span>
                  <span className="asset-type">
                    {a.asset_type}
                    {a.station != null && <span className="asset-station"> Sta.{a.station}m</span>}
                  </span>
                  {restricted && <span className="asset-badge asset-badge-restricted">No Access</span>}
                  {!restricted && a.status === 'in_progress' && (
                    <span className="asset-badge asset-badge-active">Active</span>
                  )}
                </div>
                <div className="asset-mini-bar-row">
                  <span className="asset-mini-bar-label">Overall</span>
                  <div className="asset-mini-bar-track">
                    {segments.map((seg) => (
                      <div
                        key={seg.name}
                        className="asset-mini-bar-seg"
                        style={{ flex: seg.total, background: seg.color }}
                        title={seg.name}
                      />
                    ))}
                  </div>
                  <span className="asset-progress-pct">{pct}%</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
