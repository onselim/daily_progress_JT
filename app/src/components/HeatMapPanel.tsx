import { useLanguage } from '../lib/i18n/LanguageContext';
import type { TranslationKey } from '../lib/i18n/translations/en';

export type HeatMetric = 'concrete' | 'excavation' | 'reinforcement' | 'weight';

export type MetricTotals = Record<HeatMetric, { total: number; count: number }>;

const METRICS: { key: HeatMetric; labelKey: TranslationKey; icon: string; unit: 'm3' | 'kg' }[] = [
  { key: 'excavation', labelKey: 'assetEditor.excavation', icon: '⛏', unit: 'm3' },
  { key: 'reinforcement', labelKey: 'assetEditor.reinforcement', icon: '🔩', unit: 'kg' },
  { key: 'concrete', labelKey: 'assetEditor.concrete', icon: '🧱', unit: 'm3' },
  { key: 'weight', labelKey: 'panels.towerWeight', icon: '⚙', unit: 'kg' },
];

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
  const { t } = useLanguage();

  function formatTotal(total: number, count: number, unit: 'm3' | 'kg'): string {
    if (count === 0) return t('panels.noDataForRange');
    const value = unit === 'm3' ? `${total.toFixed(2)} m³` : `${Math.round(total).toLocaleString()} kg`;
    return `${value} · ${t('panels.towersInRange', { count })}`;
  }

  return (
    <div className="heatmap-panel">
      <div className="heatmap-range-row">
        <input
          type="text"
          inputMode="numeric"
          className="heatmap-range-input"
          placeholder={t('panels.fromNum')}
          value={rangeFrom}
          onChange={(e) => onRangeFromChange(e.target.value)}
        />
        <span className="heatmap-range-dash">–</span>
        <input
          type="text"
          inputMode="numeric"
          className="heatmap-range-input"
          placeholder={t('panels.toNum')}
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
              {t(m.labelKey)}
              <span className="heatmap-metric-tooltip">{formatTotal(total, count, m.unit)}</span>
            </button>
          );
        })}
      </div>

      {activeMetric && (
        <p className="accordion-empty">
          {t('panels.towersInRange', { count: heatPointCount })}{' '}
          {rangeFrom.trim() && rangeTo.trim()
            ? t('panels.betweenRange', { from: rangeFrom, to: rangeTo })
            : t('panels.allTowers')}
        </p>
      )}
    </div>
  );
}
