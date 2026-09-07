import { AccordionPanel } from './AccordionPanel';
import { ProjectDocumentsPanel } from './ProjectDocumentsPanel';
import { WeatherPanel } from './WeatherPanel';
import { LineSummaryPanel } from './LineSummaryPanel';
import { HeatMapPanel, type HeatMetric, type MetricTotals } from './HeatMapPanel';
import type { LineSummary } from '../lib/useLineSummary';
import type { AssetListItem } from '../lib/useAssets';
import type { FoundationTypeConfig } from '../lib/useFoundationTypesConfig';
import { useLanguage } from '../lib/i18n/LanguageContext';

interface RightPanelStackProps {
  projectId: string;
  editable: boolean;
  weatherLat: number | null;
  weatherLng: number | null;
  lineSummary: LineSummary;
  heatMetric: HeatMetric | null;
  onSelectHeatMetric: (metric: HeatMetric) => void;
  heatmapRangeFrom: string;
  heatmapRangeTo: string;
  onHeatmapRangeFromChange: (value: string) => void;
  onHeatmapRangeToChange: (value: string) => void;
  heatPointCount: number;
  metricTotals: MetricTotals;
  enabledLayerIds: Set<string>;
  onToggleLayer: (layerId: string) => void;
  layerErrors: Record<string, string>;
  assets: AssetListItem[];
  foundationTypes: FoundationTypeConfig[];
  coordinateSystem: string | null;
  onLayersChanged?: () => void;
  photoCount: number;
  photosLayerEnabled: boolean;
  onTogglePhotosLayer: () => void;
}

export function RightPanelStack({
  projectId,
  editable,
  weatherLat,
  weatherLng,
  lineSummary,
  heatMetric,
  onSelectHeatMetric,
  heatmapRangeFrom,
  heatmapRangeTo,
  onHeatmapRangeFromChange,
  onHeatmapRangeToChange,
  heatPointCount,
  metricTotals,
  enabledLayerIds,
  onToggleLayer,
  layerErrors,
  assets,
  foundationTypes,
  coordinateSystem,
  onLayersChanged,
  photoCount,
  photosLayerEnabled,
  onTogglePhotosLayer,
}: RightPanelStackProps) {
  const { t } = useLanguage();
  return (
    <div className="right-panel-stack">
      <AccordionPanel title={t('panels.lineSummary')}>
        <LineSummaryPanel summary={lineSummary} />
      </AccordionPanel>

      <AccordionPanel title={t('panels.heatMap')}>
        <HeatMapPanel
          activeMetric={heatMetric}
          onSelectMetric={onSelectHeatMetric}
          rangeFrom={heatmapRangeFrom}
          rangeTo={heatmapRangeTo}
          onRangeFromChange={onHeatmapRangeFromChange}
          onRangeToChange={onHeatmapRangeToChange}
          heatPointCount={heatPointCount}
          metricTotals={metricTotals}
        />
      </AccordionPanel>

      <AccordionPanel title={t('panels.projectDocuments')}>
        <ProjectDocumentsPanel projectId={projectId} editable={editable} section="documents" />
      </AccordionPanel>

      <AccordionPanel title={t('panels.layers')}>
        <div className="osm-fetch-row">
          <button
            type="button"
            className={`doc-folder-add-btn${photosLayerEnabled ? ' active' : ''}`}
            onClick={onTogglePhotosLayer}
          >
            📷 {photosLayerEnabled ? t('panels.hideGeotaggedPhotos') : t('panels.showGeotaggedPhotos')} ({photoCount})
          </button>
        </div>
        <ProjectDocumentsPanel
          projectId={projectId}
          editable={editable}
          section="layers"
          emptyLabel={t('panels.noExtraLayers')}
          enabledLayerIds={enabledLayerIds}
          onToggleLayer={onToggleLayer}
          layerErrors={layerErrors}
          osmFetchContext={{ assets, coordinateSystem }}
          excavationContext={{ assets, foundationTypes, coordinateSystem }}
          onLayersChanged={onLayersChanged}
        />
      </AccordionPanel>

      <AccordionPanel title={t('panels.weatherForecast')}>
        <WeatherPanel lat={weatherLat} lng={weatherLng} />
      </AccordionPanel>
    </div>
  );
}
