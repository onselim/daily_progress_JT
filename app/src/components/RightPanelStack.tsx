import { AccordionPanel } from './AccordionPanel';
import { ProjectDocumentsPanel } from './ProjectDocumentsPanel';
import { WeatherPanel } from './WeatherPanel';

interface RightPanelStackProps {
  projectId: string;
  editable: boolean;
  weatherLat: number | null;
  weatherLng: number | null;
}

export function RightPanelStack({ projectId, editable, weatherLat, weatherLng }: RightPanelStackProps) {
  return (
    <div className="right-panel-stack">
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
