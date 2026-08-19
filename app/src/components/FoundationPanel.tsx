import type { FoundationTypeConfig } from '../lib/useFoundationTypesConfig';

interface FoundationPanelProps {
  foundationTypes: FoundationTypeConfig[];
  heatmapEnabled: boolean;
  onToggleHeatmap: () => void;
}

export function FoundationPanel({ foundationTypes, heatmapEnabled, onToggleHeatmap }: FoundationPanelProps) {
  if (foundationTypes.length === 0) {
    return <p className="accordion-empty">No foundation type data configured yet.</p>;
  }

  return (
    <div className="foundation-panel">
      <button
        type="button"
        className={`heatmap-toggle-btn${heatmapEnabled ? ' active' : ''}`}
        onClick={onToggleHeatmap}
      >
        {heatmapEnabled ? '🔥 Hide Concrete Heat Map' : '🔥 Show Concrete Heat Map'}
      </button>

      <table className="foundation-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Soil</th>
            <th>Concrete</th>
            <th>Excav.</th>
            <th>Reinf.</th>
            <th>Lean</th>
          </tr>
        </thead>
        <tbody>
          {foundationTypes.map((f) => (
            <tr key={f.type}>
              <td>{f.type}</td>
              <td>{f.soilType}</td>
              <td>{f.concreteM3.toFixed(2)} m³</td>
              <td>{f.excavationM3.toFixed(1)} m³</td>
              <td>{f.reinforcementKg.toLocaleString()} kg</td>
              <td>{f.leanConcreteM3.toFixed(2)} m³</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
