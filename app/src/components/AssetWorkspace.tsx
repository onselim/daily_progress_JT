import { useState } from 'react';
import { AssetList } from './AssetList';
import { AssetEditor } from './AssetEditor';
import { MapView } from './MapView';
import { useAssets } from '../lib/useAssets';
import { useProjectWorkItemsProgress } from '../lib/useProjectWorkItemsProgress';
import { useRestrictedToday } from '../lib/useRestrictedToday';

interface AssetWorkspaceProps {
  projectId: string;
  coordinateSystem: string | null;
  editable?: boolean;
}

export function AssetWorkspace({ projectId, coordinateSystem, editable = true }: AssetWorkspaceProps) {
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const { assets } = useAssets(projectId);
  const { progressByAsset } = useProjectWorkItemsProgress(projectId);
  const restrictedAssetIds = useRestrictedToday(projectId);

  return (
    <div className="asset-workspace">
      <AssetList
        projectId={projectId}
        selectedAssetId={selectedAssetId}
        onSelect={setSelectedAssetId}
        progressByAsset={progressByAsset}
        restrictedAssetIds={restrictedAssetIds}
      />
      <MapView
        assets={assets}
        coordinateSystem={coordinateSystem}
        selectedAssetId={selectedAssetId}
        onSelect={setSelectedAssetId}
        restrictedAssetIds={restrictedAssetIds}
      />
      <div className="asset-editor-slot">
        {selectedAssetId ? (
          <AssetEditor key={selectedAssetId} projectId={projectId} assetId={selectedAssetId} editable={editable} />
        ) : (
          <p className="asset-editor-empty">Select an asset from the list or map to edit it.</p>
        )}
      </div>
    </div>
  );
}
