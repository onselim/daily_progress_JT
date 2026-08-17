import type { LineSummary } from '../lib/useLineSummary';

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
  const items: { label: string; value: string; note?: string | null }[] = [
    { label: 'Total length', value: formatKm(summary.totalLengthM) },
    { label: 'Towers', value: summary.towerCount.toLocaleString() },
    { label: 'Suspension', value: formatPercent(summary.suspensionPercent) },
    { label: 'Tension', value: formatPercent(summary.tensionPercent) },
    { label: 'Angle points', value: summary.angleCount != null ? summary.angleCount.toLocaleString() : '—' },
    { label: 'Longest span', value: formatM(summary.longestSpanM), note: summary.longestSpanLabel },
    { label: 'Highest elevation', value: formatElevation(summary.maxElevation), note: summary.maxElevationCode },
    { label: 'Lowest elevation', value: formatElevation(summary.minElevation), note: summary.minElevationCode },
  ];

  return (
    <div className="line-summary-grid">
      {items.map((item) => (
        <div key={item.label} className="line-summary-item">
          <span className="line-summary-value">
            {item.value}
            {item.note && <span className="line-summary-note-inline"> ({item.note})</span>}
          </span>
          <span className="line-summary-label">{item.label}</span>
        </div>
      ))}
      {!summary.classified && (
        <p className="accordion-empty line-summary-note">
          Suspension/Tension % needs tower types set during the structure list import.
        </p>
      )}
    </div>
  );
}
