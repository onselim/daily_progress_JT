import type { FoundationTypeConfig } from '../lib/useFoundationTypesConfig';

interface FoundationPanelProps {
  foundationTypes: FoundationTypeConfig[];
  heatmapEnabled: boolean;
  onToggleHeatmap: () => void;
  rangeFrom: string;
  rangeTo: string;
  onRangeFromChange: (value: string) => void;
  onRangeToChange: (value: string) => void;
  heatPointCount: number;
}

export function FoundationPanel({
  foundationTypes,
  heatmapEnabled,
  onToggleHeatmap,
  rangeFrom,
  rangeTo,
  onRangeFromChange,
  onRangeToChange,
  heatPointCount,
}: FoundationPanelProps) {
  if (foundationTypes.length === 0) {
    return <p className="accordion-empty">No foundation type data configured yet.</p>;
  }

  return (
    <div className="foundation-panel">
      <div className="heatmap-range-row">
        <input
          type="text"
          inputMode="numeric"
          className="heatmap-range-input"
          placeholder="From #"
          value={rangeFrom}
          onChange={(e) => onRangeFromChange(e.target.value)}
        />
        <span className="heatmap-range-dash">–</span>
        <input
          type="text"
          inputMode="numeric"
          className="heatmap-range-input"
          placeholder="To #"
          value={rangeTo}
          onChange={(e) => onRangeToChange(e.target.value)}
        />
      </div>

      <button
        type="button"
        className={`heatmap-toggle-btn${heatmapEnabled ? ' active' : ''}`}
        onClick={onToggleHeatmap}
      >
        {heatmapEnabled ? '🔥 Hide Concrete Heat Map' : '🔥 Show Concrete Heat Map'}
      </button>

      {heatmapEnabled && (
        <p className="accordion-empty">
          {heatPointCount} tower{heatPointCount === 1 ? '' : 's'}
          {rangeFrom.trim() && rangeTo.trim() ? ` between #${rangeFrom} and #${rangeTo}` : ' (all towers)'}
        </p>
      )}

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
