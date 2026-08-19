import { useMemo, useState } from 'react';
import { AssetList } from './AssetList';
import { AssetEditor } from './AssetEditor';
import { MapView } from './MapView';
import { RightPanelStack } from './RightPanelStack';
import { useAssets } from '../lib/useAssets';
import { useProjectWorkItemsProgress } from '../lib/useProjectWorkItemsProgress';
import { useRestrictedToday } from '../lib/useRestrictedToday';
import { useWorkItemsConfig } from '../lib/useProjectConfig';
import { useGroundWireConfig } from '../lib/useGroundWireConfig';
import { useLineSummary } from '../lib/useLineSummary';
import { utmToLatLng } from '../lib/utmToLatLng';

interface AssetWorkspaceProps {
  projectId: string;
  coordinateSystem: string | null;
  editable?: boolean;
  onAssetSaved?: () => void;
}

export function AssetWorkspace({ projectId, coordinateSystem, editable = true, onAssetSaved }: AssetWorkspaceProps) {
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const { assets } = useAssets(projectId);
  const {
    progressByAsset,
    percentByAssetAndKey,
    refresh: refreshProgress,
  } = useProjectWorkItemsProgress(projectId);
  const { restrictedAssetIds, refresh: refreshRestricted } = useRestrictedToday(projectId);
  const { workItems } = useWorkItemsConfig(projectId);
  const groundWireConfig = useGroundWireConfig(projectId);
  const lineSummary = useLineSummary(projectId, assets, coordinateSystem);

  function handleAssetSaved() {
    refreshProgress();
    refreshRestricted();
    onAssetSaved?.();
  }

  const [weatherLat, weatherLng] = useMemo((): [number | null, number | null] => {
    if (!coordinateSystem || assets.length === 0) return [null, null];
    const focus = assets.find((a) => a.status === 'in_progress') ?? assets[0];
    if (focus.lat != null && focus.lng != null) return [focus.lat, focus.lng];
    if (focus.x != null && focus.y != null) {
      try {
        const [lat, lng] = utmToLatLng(focus.x, focus.y, coordinateSystem);
        return [lat, lng];
      } catch {
        return [null, null];
      }
    }
    return [null, null];
  }, [assets, coordinateSystem]);

  return (
    <>
      <div className="project-body">
        <AssetList
        projectId={projectId}
        selectedAssetId={selectedAssetId}
        onSelect={setSelectedAssetId}
        progressByAsset={progressByAsset}
        percentByAssetAndKey={percentByAssetAndKey}
        workItems={workItems}
        restrictedAssetIds={restrictedAssetIds}
      />
      <div className="map-stage">
        <MapView
          assets={assets}
          coordinateSystem={coordinateSystem}
          selectedAssetId={selectedAssetId}
          onSelect={setSelectedAssetId}
          restrictedAssetIds={restrictedAssetIds}
          percentByAssetAndKey={percentByAssetAndKey}
          groundWireConfig={groundWireConfig}
        />
        <RightPanelStack
          projectId={projectId}
          editable={editable}
          weatherLat={weatherLat}
          weatherLng={weatherLng}
          lineSummary={lineSummary}
        />
        {selectedAssetId && (
          <div className="floating-editor">
            <button
              type="button"
              className="floating-editor-close"
              onClick={() => setSelectedAssetId('')}
              title="Close"
              aria-label="Close"
            >
              ×
            </button>
            <AssetEditor
              key={selectedAssetId}
              projectId={projectId}
              assetId={selectedAssetId}
              coordinateSystem={coordinateSystem}
              editable={editable}
              onSaved={handleAssetSaved}
            />
          </div>
        )}
      </div>
      </div>
    </>
  );
}
