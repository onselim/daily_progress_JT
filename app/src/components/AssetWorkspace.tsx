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
import { useFoundationTypesConfig, getFoundationTypeForAsset } from '../lib/useFoundationTypesConfig';
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
  const { foundationTypes } = useFoundationTypesConfig(projectId);
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);

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

  const heatPoints = useMemo((): [number, number, number][] => {
    if (foundationTypes.length === 0) return [];
    const points: [number, number, number][] = [];
    for (const asset of assets) {
      const foundation = getFoundationTypeForAsset(asset.asset_type, foundationTypes);
      if (!foundation) continue;

      let lat = asset.lat;
      let lng = asset.lng;
      if ((lat == null || lng == null) && asset.x != null && asset.y != null && coordinateSystem) {
        try {
          [lat, lng] = utmToLatLng(asset.x, asset.y, coordinateSystem);
        } catch {
          continue;
        }
      }
      if (lat == null || lng == null) continue;

      points.push([lat, lng, foundation.concreteM3]);
    }
    return points;
  }, [assets, foundationTypes, coordinateSystem]);

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
          heatmapEnabled={heatmapEnabled}
          heatPoints={heatPoints}
        />
        <RightPanelStack
          projectId={projectId}
          editable={editable}
          weatherLat={weatherLat}
          weatherLng={weatherLng}
          lineSummary={lineSummary}
          foundationTypes={foundationTypes}
          heatmapEnabled={heatmapEnabled}
          onToggleHeatmap={() => setHeatmapEnabled((v) => !v)}
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
