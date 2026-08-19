export type HeatMetric = 'concrete' | 'excavation' | 'reinforcement' | 'weight';

export type MetricTotals = Record<HeatMetric, { total: number; count: number }>;

const METRICS: { key: HeatMetric; label: string; icon: string; unit: 'm3' | 'kg' }[] = [
  { key: 'excavation', label: 'Excavation', icon: '⛏', unit: 'm3' },
  { key: 'reinforcement', label: 'Reinforcement', icon: '🔩', unit: 'kg' },
  { key: 'concrete', label: 'Concrete', icon: '🧱', unit: 'm3' },
  { key: 'weight', label: 'Tower Weight', icon: '⚙', unit: 'kg' },
];

function formatTotal(total: number, count: number, unit: 'm3' | 'kg'): string {
  if (count === 0) return 'No data for this range';
  const value = unit === 'm3' ? `${total.toFixed(2)} m³` : `${Math.round(total).toLocaleString()} kg`;
  return `${value} · ${count} tower${count === 1 ? '' : 's'}`;
}

interface HeatMapPanelProps {
  activeMetric: HeatMetric | null;
  onSelectMetric: (metric: HeatMetric) => void;
  rangeFrom: string;
  rangeTo: string;
  onRangeFromChange: (value: string) => void;
  onRangeToChange: (value: string) => void;
  heatPointCount: number;
  metricTotals: MetricTotals;
}

export function HeatMapPanel({
  activeMetric,
  onSelectMetric,
  rangeFrom,
  rangeTo,
  onRangeFromChange,
  onRangeToChange,
  heatPointCount,
  metricTotals,
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
        {METRICS.map((m) => {
          const { total, count } = metricTotals[m.key];
          return (
            <button
              key={m.key}
              type="button"
              className={`heatmap-metric-btn${activeMetric === m.key ? ' active' : ''}`}
              onClick={() => onSelectMetric(m.key)}
            >
              <span className="heatmap-metric-icon">{m.icon}</span>
              {m.label}
              <span className="heatmap-metric-tooltip">{formatTotal(total, count, m.unit)}</span>
            </button>
          );
        })}
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
