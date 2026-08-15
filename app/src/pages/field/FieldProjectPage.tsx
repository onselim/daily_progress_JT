import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { useProjectBySlug } from '../../lib/useProject';
import { useAssetStats } from '../../lib/useAssetStats';
import { useRestrictedToday } from '../../lib/useRestrictedToday';
import { AssetWorkspace } from '../../components/AssetWorkspace';
import { ProjectProgressBar } from '../../components/ProjectProgressBar';

export default function FieldProjectPage() {
  const { slug } = useParams<{ slug: string }>();
  const { signOut } = useAuth();
  const { project, loading, error } = useProjectBySlug(slug);
  const { stats } = useAssetStats(project?.id);
  const restrictedAssetIds = useRestrictedToday(project?.id);

  if (loading) return <div className="page-loading">Loading…</div>;
  if (error || !project) return <div className="page-loading">Project not found.</div>;

  return (
    <div className="project-shell">
      <header className="project-topbar">
        <div className="project-topbar-left">
          <Link to="/field">← Projects</Link>
          <h1>{project.name}</h1>
          <p>
            <a href={`/reports/${project.slug}`} target="_blank" rel="noreferrer">
              View report
            </a>
          </p>
        </div>

        <ProjectProgressBar projectId={project.id} editable />

        <div className="project-topbar-stats">
          <span className="stat-pill">
            <span className="stat-pill-dot" style={{ background: '#00d4aa' }} />
            <span className="stat-pill-val">
              {stats.inProgress}/{stats.total}
            </span>
            <span className="stat-pill-lbl">Active</span>
          </span>
          <span className="stat-pill">
            <span className="stat-pill-dot" style={{ background: '#ef4444' }} />
            <span className="stat-pill-val">
              {restrictedAssetIds.size}/{stats.total}
            </span>
            <span className="stat-pill-lbl">No Access</span>
          </span>
          <span className="stat-pill">
            <span className="stat-pill-dot" style={{ background: '#3b82f6' }} />
            <span className="stat-pill-val">
              {stats.completed}/{stats.total}
            </span>
            <span className="stat-pill-lbl">Completed</span>
          </span>
          <span className="stat-pill">
            <span className="stat-pill-dot" style={{ background: '#3d4259' }} />
            <span className="stat-pill-val">{stats.total}</span>
            <span className="stat-pill-lbl">Towers</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => window.open(`/print/${project.slug}`, '_blank')}>
            Print PDF
          </button>
          <button onClick={signOut}>Sign out</button>
        </div>
      </header>

      <AssetWorkspace projectId={project.id} coordinateSystem={project.coordinate_system} />
    </div>
  );
}
