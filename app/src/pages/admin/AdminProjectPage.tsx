import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { useProjectBySlug } from '../../lib/useProject';
import { useAssetStats } from '../../lib/useAssetStats';
import { useRestrictedToday } from '../../lib/useRestrictedToday';
import { AssetWorkspace } from '../../components/AssetWorkspace';
import { ProjectProgressBar } from '../../components/ProjectProgressBar';
import { DeleteProjectDialog } from '../../components/DeleteProjectDialog';

export default function AdminProjectPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { project, loading, error } = useProjectBySlug(slug);
  const { stats } = useAssetStats(project?.id);
  const restrictedAssetIds = useRestrictedToday(project?.id);
  const [showDelete, setShowDelete] = useState(false);

  if (loading) return <div className="page-loading">Loading…</div>;
  if (error || !project) return <div className="page-loading">Project not found.</div>;

  return (
    <div className="project-shell">
      <header className="project-topbar">
        <div className="project-topbar-left">
          <Link to="/admin">← Projects</Link>
          <h1>{project.name}</h1>
          <p>
            <a href={`/reports/${project.slug}`} target="_blank" rel="noreferrer">
              Public link: /reports/{project.slug}
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
        <div className="project-topbar-actions">
          <button type="button" onClick={() => navigate(`/admin/${project.slug}/work-items`)}>
            Edit work items
          </button>
          <button type="button" onClick={() => window.open(`/print/${project.slug}`, '_blank')}>
            Print PDF
          </button>
          <button type="button" className="modal-danger-btn" onClick={() => setShowDelete(true)}>
            Delete
          </button>
          <button onClick={signOut}>Sign out</button>
        </div>
      </header>

      <AssetWorkspace projectId={project.id} coordinateSystem={project.coordinate_system} />

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
