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
  const [heatmapRangeFrom, setHeatmapRangeFrom] = useState('');
  const [heatmapRangeTo, setHeatmapRangeTo] = useState('');

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

  // Range is by asset_code (the "1, 2, 3…" numbers shown in the tower list), not station —
  // that's how the user thinks about "towers 4 to 44".
  const rangeFromNum = heatmapRangeFrom.trim() ? Number(heatmapRangeFrom) : null;
  const rangeToNum = heatmapRangeTo.trim() ? Number(heatmapRangeTo) : null;
  const hasValidRange = rangeFromNum != null && rangeToNum != null && !Number.isNaN(rangeFromNum) && !Number.isNaN(rangeToNum);

  const heatPointsWithAsset = useMemo((): { assetId: string; lat: number; lng: number; weight: number }[] => {
    if (foundationTypes.length === 0) return [];
    const lo = hasValidRange ? Math.min(rangeFromNum!, rangeToNum!) : null;
    const hi = hasValidRange ? Math.max(rangeFromNum!, rangeToNum!) : null;

    const points: { assetId: string; lat: number; lng: number; weight: number }[] = [];
    for (const asset of assets) {
      if (lo != null && hi != null) {
        const code = Number(asset.asset_code);
        if (Number.isNaN(code) || code < lo || code > hi) continue;
      }

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

      points.push({ assetId: asset.id, lat, lng, weight: foundation.concreteM3 });
    }
    return points;
  }, [assets, foundationTypes, coordinateSystem, hasValidRange, rangeFromNum, rangeToNum]);

  const heatPoints = useMemo(
    (): [number, number, number][] => heatPointsWithAsset.map((p) => [p.lat, p.lng, p.weight]),
    [heatPointsWithAsset],
  );

  // Concrete-weighted center of gravity of the selected towers, shown at two spots: a
  // marker on the map itself, and a highlighted entry in the tower list (the nearest
  // actual tower to that weighted point) so it's visible against the line too.
  const heatCentroid = useMemo((): [number, number] | null => {
    if (heatPointsWithAsset.length === 0) return null;
    let sumLat = 0;
    let sumLng = 0;
    let sumW = 0;
    for (const p of heatPointsWithAsset) {
      sumLat += p.lat * p.weight;
      sumLng += p.lng * p.weight;
      sumW += p.weight;
    }
    if (sumW === 0) return null;
    return [sumLat / sumW, sumLng / sumW];
  }, [heatPointsWithAsset]);

  const heatCentroidAssetId = useMemo((): string | null => {
    if (!heatCentroid) return null;
    let nearestId: string | null = null;
    let nearestDist = Infinity;
    for (const p of heatPointsWithAsset) {
      const d = Math.hypot(p.lat - heatCentroid[0], p.lng - heatCentroid[1]);
      if (d < nearestDist) {
        nearestDist = d;
        nearestId = p.assetId;
      }
    }
    return nearestId;
  }, [heatCentroid, heatPointsWithAsset]);

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
        heatCentroidAssetId={heatmapEnabled ? heatCentroidAssetId : null}
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
          heatCentroid={heatCentroid}
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
          heatmapRangeFrom={heatmapRangeFrom}
          heatmapRangeTo={heatmapRangeTo}
          onHeatmapRangeFromChange={setHeatmapRangeFrom}
          onHeatmapRangeToChange={setHeatmapRangeTo}
          heatPointCount={heatPoints.length}
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
