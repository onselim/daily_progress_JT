import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useProjectBySlug } from '../lib/useProject';
import { useAssetStats } from '../lib/useAssetStats';
import { useRestrictedAssetCodes } from '../lib/useRestrictedAssetCodes';
import { useAssets } from '../lib/useAssets';
import { useWorkItemsConfig } from '../lib/useProjectConfig';
import { useConstructionBreakdown } from '../lib/useConstructionBreakdown';
import { useDailyLogEntries } from '../lib/useDailyLogEntries';
import { useWeatherForecast } from '../lib/useWeatherForecast';
import { utmToLatLng } from '../lib/utmToLatLng';

function formatDate() {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function PrintReportPage() {
  const { slug } = useParams<{ slug: string }>();
  const { project, loading, error } = useProjectBySlug(slug);
  const { stats } = useAssetStats(project?.id);
  const restrictedCodes = useRestrictedAssetCodes(project?.id);
  const { assets } = useAssets(project?.id);
  const { workItems } = useWorkItemsConfig(project?.id);
  const { items, overallPercent: constructionPercent } = useConstructionBreakdown(project?.id, workItems);
  const { entries } = useDailyLogEntries(project?.id);

  const [weatherLat, weatherLng] = useMemo((): [number | null, number | null] => {
    if (!project?.coordinate_system || assets.length === 0) return [null, null];
    const focus = assets.find((a) => a.status === 'in_progress') ?? assets[0];
    if (focus.lat != null && focus.lng != null) return [focus.lat, focus.lng];
    if (focus.x != null && focus.y != null) {
      try {
        return utmToLatLng(focus.x, focus.y, project.coordinate_system);
      } catch {
        return [null, null];
      }
    }
    return [null, null];
  }, [assets, project?.coordinate_system]);

  const { days: weatherDays } = useWeatherForecast(weatherLat, weatherLng);

  useEffect(() => {
    document.title = project ? `${project.name} — Daily Progress Report` : 'Daily Progress Report';
  }, [project]);

  if (loading) return <div className="page-loading">Loading…</div>;
  if (error || !project) {
    return (
      <div className="page-loading">
        <p>This project report is not available.</p>
      </div>
    );
  }

  const todayEntries = entries.filter((e) => e.completedToday.trim());
  const tomorrowEntries = entries.filter((e) => e.plannedTomorrow.trim());
  const shownRestricted = restrictedCodes.slice(0, 14);
  const extraRestricted = restrictedCodes.length - shownRestricted.length;

  return (
    <div className="pd-page">
      <div className="pd-toolbar">
        <button onClick={() => window.print()}>Print / Save as PDF</button>
      </div>

      <div className="pd-sheet">
        <header className="pd-header">
          <div className="pd-header-left">
            <div className="pd-logo">
              <svg width="20" height="20" viewBox="0 0 40 40" fill="none">
                <path
                  d="M8 32 L20 10 L32 32"
                  stroke="#fff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="20" cy="25" r="4" fill="#60a5fa" />
              </svg>
            </div>
            <div>
              <div className="pd-title">{project.name}</div>
              <div className="pd-sub">DAILY PROGRESS REPORT — FIELD STATUS SUMMARY</div>
            </div>
          </div>
          <div className="pd-header-right">
            <div className="pd-date">{formatDate()}</div>
            {project.contract_no && <div className="pd-contract">Contract No: {project.contract_no}</div>}
          </div>
        </header>

        <div className="pd-stat-row">
          <div className="pd-stat-main">
            <div className="pd-stat-main-val">{constructionPercent.toFixed(2)}%</div>
            <div className="pd-stat-lbl">OVERALL PROJECT COMPLETION</div>
            <div className="pd-stat-bar">
              <div className="pd-stat-bar-fill" style={{ width: `${Math.min(constructionPercent, 100)}%` }} />
            </div>
          </div>
          <div className="pd-stat pd-stat-green">
            <div className="pd-stat-val">{stats.inProgress}</div>
            <div className="pd-stat-lbl">Active today</div>
          </div>
          <div className="pd-stat pd-stat-red">
            <div className="pd-stat-val">{restrictedCodes.length}</div>
            <div className="pd-stat-lbl">No access</div>
          </div>
          <div className="pd-stat">
            <div className="pd-stat-val">{stats.total}</div>
            <div className="pd-stat-lbl">Total towers</div>
          </div>
          <div className="pd-stat pd-stat-green">
            <div className="pd-stat-val">{constructionPercent.toFixed(2)}%</div>
            <div className="pd-stat-lbl">Construction</div>
          </div>
          <div className="pd-stat pd-stat-blue">
            <div className="pd-stat-val pd-stat-val-sm">Not tracked</div>
            <div className="pd-stat-lbl">Supply</div>
          </div>
        </div>

        <div className="pd-3col">
          <div className="pd-box">
            <div className="pd-box-title">
              <span className="pd-dot" style={{ background: '#10b981' }} />
              Construction progress
            </div>
            {items.map((item) => (
              <div key={item.key} className="pd-bar-row">
                <span className={`pd-bar-lbl${item.percentComplete <= 0 ? ' pd-bar-lbl-muted' : ''}`}>
                  {item.label}
                </span>
                <div className="pd-bar-track">
                  <div
                    className="pd-bar-fill2"
                    style={{ width: `${Math.min(item.percentComplete, 100)}%`, background: '#10b981' }}
                  />
                </div>
                <span className="pd-bar-val">{item.percentComplete.toFixed(1)}%</span>
              </div>
            ))}
            <div className="pd-subtotal">
              <span>Overall</span>
              <span style={{ color: '#10b981' }}>{constructionPercent.toFixed(2)}%</span>
            </div>
          </div>

          <div className="pd-box">
            <div className="pd-box-title">
              <span className="pd-dot" style={{ background: '#2563eb' }} />
              Supply status
            </div>
            <p className="pd-muted">
              Not tracked yet — this project has no material/supply delivery data source configured.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="pd-box">
              <div className="pd-box-title">
                <span className="pd-dot" style={{ background: '#f59e0b' }} />
                Weather forecast
              </div>
              {weatherDays ? (
                <div className="pd-weather-row">
                  {weatherDays.slice(0, 5).map((d) => (
                    <div key={d.date} className="pd-weather-day">
                      <div className="day">
                        {new Date(`${d.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short' })}
                      </div>
                      <div className="temp">
                        {d.tempMin}°/{d.tempMax}°
                      </div>
                      <div className="rain" style={{ color: d.precipProbability > 50 ? '#dc2626' : '#059669' }}>
                        {d.precipProbability}%
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="pd-muted">No tower location available.</p>
              )}
            </div>

            <div className="pd-box">
              <div className="pd-box-title">Site conditions</div>
              <div className="pd-condition">
                <span style={{ color: '#059669' }}>✓</span>
                <span style={{ color: '#059669', fontWeight: 700 }}>Normal working day</span>
              </div>
            </div>

            {restrictedCodes.length > 0 && (
              <div className="pd-box pd-box-red">
                <div className="pd-box-title" style={{ color: '#dc2626' }}>
                  No access — {restrictedCodes.length} towers
                </div>
                <div className="pd-badges">
                  {shownRestricted.map((code) => (
                    <span key={code} className="pd-badge">
                      T{code}
                    </span>
                  ))}
                  {extraRestricted > 0 && <span className="pd-badge-more">+{extraRestricted}</span>}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="pd-2col">
          <div className="pd-box">
            <div className="pd-box-title">
              <span className="pd-dot pd-dot-round" style={{ background: '#059669' }} />
              Today&#39;s progress
            </div>
            <table className="pd-table">
              <thead>
                <tr>
                  <th>Tower</th>
                  <th>Type</th>
                  <th>Activity completed</th>
                </tr>
              </thead>
              <tbody>
                {todayEntries.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="pd-empty-row">
                      No activities recorded
                    </td>
                  </tr>
                ) : (
                  todayEntries.map((e) => (
                    <tr key={e.assetCode}>
                      <td>T{e.assetCode}</td>
                      <td>{e.assetType}</td>
                      <td>{e.completedToday}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="pd-box">
            <div className="pd-box-title">
              <span className="pd-dot pd-dot-round" style={{ background: '#2563eb' }} />
              Plan for tomorrow
            </div>
            <table className="pd-table">
              <thead>
                <tr>
                  <th>Tower</th>
                  <th>Type</th>
                  <th>Planned activity</th>
                </tr>
              </thead>
              <tbody>
                {tomorrowEntries.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="pd-empty-row">
                      No plans recorded
                    </td>
                  </tr>
                ) : (
                  tomorrowEntries.map((e) => (
                    <tr key={e.assetCode}>
                      <td>T{e.assetCode}</td>
                      <td>{e.assetType}</td>
                      <td>{e.plannedTomorrow}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="pd-footer">
          <span>Prepared by: Site Engineer &nbsp;·&nbsp; Approved by: Resident Engineer</span>
          <span>
            {project.name} &nbsp;·&nbsp; Lot 1 &nbsp;·&nbsp; © {new Date().getFullYear()}
          </span>
        </footer>
      </div>
    </div>
  );
}
