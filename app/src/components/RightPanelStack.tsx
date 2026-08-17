import { AccordionPanel } from './AccordionPanel';
import { ProjectDocumentsPanel } from './ProjectDocumentsPanel';
import { WeatherPanel } from './WeatherPanel';
import { LineSummaryPanel } from './LineSummaryPanel';
import type { LineSummary } from '../lib/useLineSummary';

interface RightPanelStackProps {
  projectId: string;
  editable: boolean;
  weatherLat: number | null;
  weatherLng: number | null;
  lineSummary: LineSummary;
}

export function RightPanelStack({ projectId, editable, weatherLat, weatherLng, lineSummary }: RightPanelStackProps) {
  return (
    <div className="right-panel-stack">
      <AccordionPanel title="Line summary" defaultOpen>
        <LineSummaryPanel summary={lineSummary} />
      </AccordionPanel>

      <AccordionPanel title="Project documents">
        <ProjectDocumentsPanel projectId={projectId} editable={editable} />
      </AccordionPanel>

      <AccordionPanel title="Layers">
        <p className="accordion-empty">No extra map layers configured yet.</p>
      </AccordionPanel>

      <AccordionPanel title="Weather forecast">
        <WeatherPanel lat={weatherLat} lng={weatherLng} />
      </AccordionPanel>
    </div>
  );
}
