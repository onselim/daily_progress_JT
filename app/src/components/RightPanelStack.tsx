import { AccordionPanel } from './AccordionPanel';
import { ProjectDocumentsPanel } from './ProjectDocumentsPanel';
import { DesignPanel } from './DesignPanel';
import { SupplyPanel } from './SupplyPanel';
import { WeatherPanel } from './WeatherPanel';
import { useDesignBreakdown } from '../lib/useDesignBreakdown';
import { useSupplyBreakdown } from '../lib/useSupplyBreakdown';

interface RightPanelStackProps {
  projectId: string;
  editable: boolean;
  weatherLat: number | null;
  weatherLng: number | null;
}

export function RightPanelStack({ projectId, editable, weatherLat, weatherLng }: RightPanelStackProps) {
  const design = useDesignBreakdown(projectId);
  const supply = useSupplyBreakdown(projectId);

  return (
    <div className="right-panel-stack">
      <AccordionPanel title="Project documents">
        <ProjectDocumentsPanel projectId={projectId} editable={editable} />
      </AccordionPanel>

      <AccordionPanel title="Design" badge={`${design.overallPercent.toFixed(1)}%`}>
        <DesignPanel
          projectId={projectId}
          editable={editable}
          items={design.items}
          overallPercent={design.overallPercent}
          loading={design.loading}
          onSaved={design.refresh}
        />
      </AccordionPanel>

      <AccordionPanel title="Supply" badge={`${supply.overallPercent.toFixed(1)}%`}>
        <SupplyPanel
          projectId={projectId}
          editable={editable}
          items={supply.items}
          overallPercent={supply.overallPercent}
          loading={supply.loading}
          onSaved={supply.refresh}
        />
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
