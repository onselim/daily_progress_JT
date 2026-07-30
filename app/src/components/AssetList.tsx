import { useState } from 'react';
import { useAssets } from '../lib/useAssets';

const STATUS_COLOR: Record<string, string> = {
  not_started: '#3d4259',
  in_progress: '#f59e0b',
  completed: '#00d4aa',
  on_hold: '#ef4444',
};

interface AssetListProps {
  projectId: string;
  selectedAssetId: string;
  onSelect: (assetId: string) => void;
  progressByAsset: Record<string, number>;
  restrictedAssetIds: Set<string>;
}

export function AssetList({
  projectId,
  selectedAssetId,
  onSelect,
  progressByAsset,
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
          const color = restricted ? '#ef4444' : STATUS_COLOR[a.status];
          return (
            <li key={a.id}>
              <button
                type="button"
                className={`asset-list-item${a.id === selectedAssetId ? ' active' : ''}`}
                onClick={() => onSelect(a.id)}
              >
                <div className="asset-list-item-row">
                  <span className="asset-code">{a.asset_code}</span>
                  {a.asset_type && <span className="asset-type">{a.asset_type}</span>}
                  {restricted && <span className="asset-badge asset-badge-restricted">No Access</span>}
                </div>
                <div className="asset-progress-track">
                  <div className="asset-progress-fill" style={{ width: `${pct}%`, background: color }} />
                </div>
                <span className="asset-progress-pct">{pct}%</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
