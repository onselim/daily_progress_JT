import { AccordionPanel } from './AccordionPanel';
import { ProjectDocumentsPanel } from './ProjectDocumentsPanel';
import { WeatherPanel } from './WeatherPanel';
import { LineSummaryPanel } from './LineSummaryPanel';
import { HeatMapPanel, type HeatMetric, type MetricTotals } from './HeatMapPanel';
import type { LineSummary } from '../lib/useLineSummary';
import type { AssetListItem } from '../lib/useAssets';
import type { FoundationTypeConfig } from '../lib/useFoundationTypesConfig';

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
}: RightPanelStackProps) {
  return (
    <div className="right-panel-stack">
      <AccordionPanel title="Line summary">
        <LineSummaryPanel summary={lineSummary} />
      </AccordionPanel>

      <AccordionPanel title="Heat Map">
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

      <AccordionPanel title="Project documents">
        <ProjectDocumentsPanel projectId={projectId} editable={editable} section="documents" />
      </AccordionPanel>

      <AccordionPanel title="Layers">
        <ProjectDocumentsPanel
          projectId={projectId}
          editable={editable}
          section="layers"
          emptyLabel="No extra map layers configured yet."
          enabledLayerIds={enabledLayerIds}
          onToggleLayer={onToggleLayer}
          layerErrors={layerErrors}
          osmFetchContext={{ assets, coordinateSystem }}
          excavationContext={{ assets, foundationTypes, coordinateSystem }}
          onLayersChanged={onLayersChanged}
        />
      </AccordionPanel>

      <AccordionPanel title="Weather forecast">
        <WeatherPanel lat={weatherLat} lng={weatherLng} />
      </AccordionPanel>
    </div>
  );
}
