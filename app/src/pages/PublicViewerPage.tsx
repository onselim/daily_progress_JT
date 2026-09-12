import { useParams } from 'react-router-dom';
import { useProjectBySlug } from '../lib/useProject';
import { useAssetStats } from '../lib/useAssetStats';
import { useRestrictedToday } from '../lib/useRestrictedToday';
import { useAssets } from '../lib/useAssets';
import { useWorkItemsConfig } from '../lib/useProjectConfig';
import { useReportSnapshots } from '../lib/useReportSnapshots';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { AssetWorkspace } from '../components/AssetWorkspace';
import { ProjectProgressBar } from '../components/ProjectProgressBar';
import { DailyPlanRow } from '../components/DailyPlanRow';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export default function PublicViewerPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t, n, language } = useLanguage();

  function formatSnapshotDate(iso: string) {
    const [yyyy, mm, dd] = iso.split('-');
    return n(`${dd}.${mm}.${yyyy}`);
  }
  const { project, loading, error } = useProjectBySlug(slug);
  const { stats } = useAssetStats(project?.id);
  const { restrictedAssetIds } = useRestrictedToday(project?.id);
  const { assets } = useAssets(project?.id);
  const { workItems } = useWorkItemsConfig(project?.id);
  const { snapshots } = useReportSnapshots(project?.id);

  if (loading) return <div className="page-loading">{t('common.loading')}</div>;

  if (error || !project) {
    return (
      <div className="page-loading">
        <p>{t('topbar.reportNotAvailable')}</p>
      </div>
    );
  }

  return (
    <div className="project-shell">
      <header className="project-topbar">
        <div className="project-topbar-row1">
          <div className="project-topbar-left">
            <h1>{project.name}</h1>
            {project.client && <p>{project.client}</p>}
          </div>

          <ProjectProgressBar projectId={project.id} projectSlug={project.slug} editable={false} isAdmin={false} />

          <div className="project-topbar-stats">
            <span className="stat-pill">
              <span className="stat-pill-dot" style={{ background: '#00d4aa' }} />
              <span className="stat-pill-val">
                {n(stats.inProgress)}/{n(stats.total)}
              </span>
              <span className="stat-pill-lbl">{t('status.active')}</span>
            </span>
            <span className="stat-pill">
              <span className="stat-pill-dot" style={{ background: '#ef4444' }} />
              <span className="stat-pill-val">
                {n(restrictedAssetIds.size)}/{n(stats.total)}
              </span>
              <span className="stat-pill-lbl">{t('status.noAccess')}</span>
            </span>
            <span className="stat-pill">
              <span className="stat-pill-dot" style={{ background: '#3b82f6' }} />
              <span className="stat-pill-val">
                {n(stats.completed)}/{n(stats.total)}
              </span>
              <span className="stat-pill-lbl">{t('status.completed')}</span>
            </span>
            <span className="stat-pill">
              <span className="stat-pill-dot" style={{ background: '#3d4259' }} />
              <span className="stat-pill-val">{n(stats.total)}</span>
              <span className="stat-pill-lbl">{t('status.towers')}</span>
            </span>
          </div>
          <div className="project-topbar-actions">
            <LanguageSwitcher />
            {snapshots.length > 0 && (
              <select
                className="report-history-select"
                defaultValue=""
                onChange={(e) => {
                  const url = e.target.value;
                  if (url) window.open(url, '_blank');
                  e.target.value = '';
                }}
              >
                <option value="" disabled>
                  {t('topbar.reportHistory')}
                </option>
                {snapshots.map((s) => (
                  <option key={s.report_date} value={s.pdf_url}>
                    {formatSnapshotDate(s.report_date)}
                  </option>
                ))}
              </select>
            )}
            <button type="button" onClick={() => window.open(`/print/${project.slug}?lang=${language}`, '_blank')}>
              {t('common.printPdf')}
            </button>
          </div>
        </div>

        <div className="project-topbar-row2">
          <DailyPlanRow projectId={project.id} assets={assets} workItems={workItems} editable={false} />
        </div>
      </header>

      <AssetWorkspace projectId={project.id} coordinateSystem={project.coordinate_system} editable={false} />
    </div>
  );
}
