import { AccordionPanel } from './AccordionPanel';
import { ProjectDocumentsPanel } from './ProjectDocumentsPanel';
import { WeatherPanel } from './WeatherPanel';
import { LineSummaryPanel } from './LineSummaryPanel';
import { FoundationPanel } from './FoundationPanel';
import { HeatMapPanel, type HeatMetric } from './HeatMapPanel';
import type { LineSummary } from '../lib/useLineSummary';
import type { FoundationTypeConfig } from '../lib/useFoundationTypesConfig';

interface RightPanelStackProps {
  projectId: string;
  editable: boolean;
  weatherLat: number | null;
  weatherLng: number | null;
  lineSummary: LineSummary;
  foundationTypes: FoundationTypeConfig[];
  heatMetric: HeatMetric | null;
  onSelectHeatMetric: (metric: HeatMetric) => void;
  heatmapRangeFrom: string;
  heatmapRangeTo: string;
  onHeatmapRangeFromChange: (value: string) => void;
  onHeatmapRangeToChange: (value: string) => void;
  heatPointCount: number;
}

export function RightPanelStack({
  projectId,
  editable,
  weatherLat,
  weatherLng,
  lineSummary,
  foundationTypes,
  heatMetric,
  onSelectHeatMetric,
  heatmapRangeFrom,
  heatmapRangeTo,
  onHeatmapRangeFromChange,
  onHeatmapRangeToChange,
  heatPointCount,
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
        />
      </AccordionPanel>

      <AccordionPanel title="Foundation">
        <FoundationPanel foundationTypes={foundationTypes} />
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
        />
      </AccordionPanel>

      <AccordionPanel title="Weather forecast">
        <WeatherPanel lat={weatherLat} lng={weatherLng} />
      </AccordionPanel>
    </div>
  );
}
