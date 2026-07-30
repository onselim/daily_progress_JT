import { useState } from 'react';
import { useAssets } from '../lib/useAssets';

const STATUS_DOT: Record<string, string> = {
  not_started: '#6b7280',
  in_progress: '#f59e0b',
  completed: '#10b981',
  on_hold: '#ef4444',
};

interface AssetListProps {
  projectId: string;
  selectedAssetId: string;
  onSelect: (assetId: string) => void;
}

export function AssetList({ projectId, selectedAssetId, onSelect }: AssetListProps) {
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
        {filtered.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              className={`asset-list-item${a.id === selectedAssetId ? ' active' : ''}`}
              onClick={() => onSelect(a.id)}
            >
              <span className="asset-dot" style={{ background: STATUS_DOT[a.status] }} />
              <span className="asset-code">{a.asset_code}</span>
              {a.asset_type && <span className="asset-type">{a.asset_type}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
