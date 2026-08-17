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
  const items: { label: string; value: string }[] = [
    { label: 'Total length', value: formatKm(summary.totalLengthM) },
    { label: 'Towers', value: summary.towerCount.toLocaleString() },
    { label: 'Suspension', value: formatPercent(summary.suspensionPercent) },
    { label: 'Tension', value: formatPercent(summary.tensionPercent) },
    { label: 'Angle points', value: summary.angleCount != null ? summary.angleCount.toLocaleString() : '—' },
    { label: 'Longest span', value: formatM(summary.longestSpanM) },
    { label: 'Highest elevation', value: formatElevation(summary.maxElevation) },
    { label: 'Lowest elevation', value: formatElevation(summary.minElevation) },
  ];

  return (
    <div className="line-summary-grid">
      {items.map((item) => (
        <div key={item.label} className="line-summary-item">
          <span className="line-summary-value">{item.value}</span>
          <span className="line-summary-label">{item.label}</span>
        </div>
      ))}
      {!summary.hasCategories && (
        <p className="accordion-empty line-summary-note">
          Suspension/Tension % needs tower types classified during the structure list import.
        </p>
      )}
    </div>
  );
}
