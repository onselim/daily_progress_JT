import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { useProjectBySlug } from '../../lib/useProject';
import { useAssetStats } from '../../lib/useAssetStats';
import { useRestrictedToday } from '../../lib/useRestrictedToday';
import { useAssets } from '../../lib/useAssets';
import { useWorkItemsConfig } from '../../lib/useProjectConfig';
import { useLanguage } from '../../lib/i18n/LanguageContext';
import { AssetWorkspace } from '../../components/AssetWorkspace';
import { ProjectProgressBar } from '../../components/ProjectProgressBar';
import { DailyPlanRow } from '../../components/DailyPlanRow';
import { DeleteProjectDialog } from '../../components/DeleteProjectDialog';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';

export default function AdminProjectPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { t, n, language } = useLanguage();
  const { project, loading, error } = useProjectBySlug(slug);
  const { stats } = useAssetStats(project?.id);
  const { restrictedAssetIds } = useRestrictedToday(project?.id);
  const { assets } = useAssets(project?.id);
  const { workItems } = useWorkItemsConfig(project?.id);
  const [showDelete, setShowDelete] = useState(false);
  const [dailyRefreshSignal, setDailyRefreshSignal] = useState(0);

  if (loading) return <div className="page-loading">{t('common.loading')}</div>;
  if (error || !project) return <div className="page-loading">{t('common.projectNotFound')}</div>;

  return (
    <div className="project-shell">
      <header className="project-topbar">
        <div className="project-topbar-row1">
          <div className="project-topbar-left">
            <Link to="/admin">{t('topbar.backToProjects')}</Link>
            <h1>{project.name}</h1>
            <p>
              <a href={`/reports/${project.slug}`} target="_blank" rel="noreferrer">
                {t('topbar.publicLink', { path: `/reports/${project.slug}` })}
              </a>
            </p>
          </div>

          <ProjectProgressBar projectId={project.id} projectSlug={project.slug} editable isAdmin />

          <DailyPlanRow
            projectId={project.id}
            assets={assets}
            workItems={workItems}
            editable
            refreshSignal={dailyRefreshSignal}
          />

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
            <button type="button" onClick={() => navigate(`/admin/${project.slug}/work-items`)}>
              {t('topbar.editWorkItems')}
            </button>
            <button type="button" onClick={() => window.open(`/print/${project.slug}?lang=${language}`, '_blank')}>
              {t('common.printPdf')}
            </button>
            <button type="button" onClick={() => navigate(`/admin/${project.slug}/report-settings`)}>
              {t('topbar.reportSettings')}
            </button>
            <button type="button" onClick={() => navigate(`/admin/${project.slug}/team`)}>
              {t('topbar.manageTeam')}
            </button>
            <button type="button" className="modal-danger-btn" onClick={() => setShowDelete(true)}>
              {t('common.delete')}
            </button>
            <button onClick={signOut}>{t('common.signOut')}</button>
          </div>
        </div>
      </header>

      <AssetWorkspace
        projectId={project.id}
        coordinateSystem={project.coordinate_system}
        isAdmin
        onAssetSaved={() => setDailyRefreshSignal((s) => s + 1)}
      />

      {showDelete && (
        <DeleteProjectDialog
          projectId={project.id}
          projectName={project.name}
          onClose={() => setShowDelete(false)}
          onDeleted={() => navigate('/admin')}
        />
      )}
    </div>
  );
}
