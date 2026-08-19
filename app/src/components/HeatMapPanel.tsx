export type HeatMetric = 'concrete' | 'excavation' | 'reinforcement' | 'weight';

const METRICS: { key: HeatMetric; label: string; icon: string }[] = [
  { key: 'excavation', label: 'Excavation', icon: '⛏' },
  { key: 'reinforcement', label: 'Reinforcement', icon: '🔩' },
  { key: 'concrete', label: 'Concrete', icon: '🧱' },
  { key: 'weight', label: 'Tower Weight', icon: '⚙' },
];

interface HeatMapPanelProps {
  activeMetric: HeatMetric | null;
  onSelectMetric: (metric: HeatMetric) => void;
  rangeFrom: string;
  rangeTo: string;
  onRangeFromChange: (value: string) => void;
  onRangeToChange: (value: string) => void;
  heatPointCount: number;
}

export function HeatMapPanel({
  activeMetric,
  onSelectMetric,
  rangeFrom,
  rangeTo,
  onRangeFromChange,
  onRangeToChange,
  heatPointCount,
}: HeatMapPanelProps) {
  return (
    <div className="heatmap-panel">
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

      <div className="heatmap-metric-grid">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            className={`heatmap-metric-btn${activeMetric === m.key ? ' active' : ''}`}
            onClick={() => onSelectMetric(m.key)}
          >
            <span className="heatmap-metric-icon">{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      {activeMetric && (
        <p className="accordion-empty">
          {heatPointCount} tower{heatPointCount === 1 ? '' : 's'}
          {rangeFrom.trim() && rangeTo.trim() ? ` between #${rangeFrom} and #${rangeTo}` : ' (all towers)'}
        </p>
      )}
    </div>
  );
}
