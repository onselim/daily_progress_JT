import type { LineSummary } from '../lib/useLineSummary';
import { useLanguage } from '../lib/i18n/LanguageContext';

interface LineSummaryPanelProps {
  summary: LineSummary;
}

function formatKm(meters: number | null): string {
  if (meters == null) return '—';
  return `${(meters / 1000).toFixed(2)} km`;
}

function formatM(meters: number | null): string {
  if (meters == null) return '—';
  return `${Math.round(meters).toLocaleString()} m`;
}

function formatElevation(z: number | null): string {
  if (z == null) return '—';
  return `${Math.round(z).toLocaleString()} m`;
}

function formatPercent(p: number | null): string {
  if (p == null) return '—';
  return `${p.toFixed(1)}%`;
}

export function LineSummaryPanel({ summary }: LineSummaryPanelProps) {
  const { t, n } = useLanguage();
  const items: { label: string; value: string; note?: string | null }[] = [
    { label: t('panels.totalLength'), value: formatKm(summary.totalLengthM) },
    { label: t('status.towers'), value: summary.towerCount.toLocaleString() },
    { label: t('panels.suspension'), value: formatPercent(summary.suspensionPercent) },
    { label: t('panels.tension'), value: formatPercent(summary.tensionPercent) },
    { label: t('panels.anglePoints'), value: summary.angleCount != null ? summary.angleCount.toLocaleString() : '—' },
    { label: t('panels.longestSpan'), value: formatM(summary.longestSpanM), note: summary.longestSpanLabel },
    { label: t('panels.highestElevation'), value: formatElevation(summary.maxElevation), note: summary.maxElevationCode },
    { label: t('panels.lowestElevation'), value: formatElevation(summary.minElevation), note: summary.minElevationCode },
  ];

  return (
    <div className="line-summary-grid">
      {items.map((item) => (
        <div key={item.label} className="line-summary-item">
          <span className="line-summary-value">
            {n(item.value)}
            {item.note && <span className="line-summary-note-inline"> ({item.note})</span>}
          </span>
          <span className="line-summary-label">{item.label}</span>
        </div>
      ))}
      {!summary.classified && (
        <p className="accordion-empty line-summary-note">{t('panels.suspensionTensionHint')}</p>
      )}
    </div>
  );
}
