import { useState } from 'react';
import { AssetList } from './AssetList';
import { AssetEditor } from './AssetEditor';
import { MapView } from './MapView';
import { useAssets } from '../lib/useAssets';

interface AssetWorkspaceProps {
  projectId: string;
  coordinateSystem: string | null;
}

export function AssetWorkspace({ projectId, coordinateSystem }: AssetWorkspaceProps) {
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const { assets } = useAssets(projectId);

  return (
    <div className="asset-workspace">
      <AssetList projectId={projectId} selectedAssetId={selectedAssetId} onSelect={setSelectedAssetId} />
      <MapView
        assets={assets}
        coordinateSystem={coordinateSystem}
        selectedAssetId={selectedAssetId}
        onSelect={setSelectedAssetId}
      />
      <div className="asset-editor-slot">
        {selectedAssetId ? (
          <AssetEditor key={selectedAssetId} projectId={projectId} assetId={selectedAssetId} />
        ) : (
          <p className="asset-editor-empty">Select an asset from the list or map to edit it.</p>
        )}
      </div>
    </div>
  );
}
