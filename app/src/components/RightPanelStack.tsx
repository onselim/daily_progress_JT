import { AccordionPanel } from './AccordionPanel';
import { ProjectDocumentsPanel } from './ProjectDocumentsPanel';
import { WeatherPanel } from './WeatherPanel';
import { LineSummaryPanel } from './LineSummaryPanel';
import { FoundationPanel } from './FoundationPanel';
import type { LineSummary } from '../lib/useLineSummary';
import type { FoundationTypeConfig } from '../lib/useFoundationTypesConfig';

interface RightPanelStackProps {
  projectId: string;
  editable: boolean;
  weatherLat: number | null;
  weatherLng: number | null;
  lineSummary: LineSummary;
  foundationTypes: FoundationTypeConfig[];
  heatmapEnabled: boolean;
  onToggleHeatmap: () => void;
}

export function RightPanelStack({
  projectId,
  editable,
  weatherLat,
  weatherLng,
  lineSummary,
  foundationTypes,
  heatmapEnabled,
  onToggleHeatmap,
}: RightPanelStackProps) {
  return (
    <div className="right-panel-stack">
      <AccordionPanel title="Line summary">
        <LineSummaryPanel summary={lineSummary} />
      </AccordionPanel>

      <AccordionPanel title="Foundation">
        <FoundationPanel
          foundationTypes={foundationTypes}
          heatmapEnabled={heatmapEnabled}
          onToggleHeatmap={onToggleHeatmap}
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
        />
      </AccordionPanel>

      <AccordionPanel title="Weather forecast">
        <WeatherPanel lat={weatherLat} lng={weatherLng} />
      </AccordionPanel>
    </div>
  );
}
