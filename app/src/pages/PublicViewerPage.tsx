import { useParams } from 'react-router-dom';
import { useProjectBySlug } from '../lib/useProject';
import { useAssetStats } from '../lib/useAssetStats';

export default function PublicViewerPage() {
  const { slug } = useParams<{ slug: string }>();
  const { project, loading, error } = useProjectBySlug(slug);
  const { stats } = useAssetStats(project?.id);

  if (loading) return <div className="page-loading">Loading…</div>;

  if (error || !project) {
    return (
      <div className="page-loading">
        <p>This project report is not available.</p>
      </div>
    );
  }

  return (
    <div className="viewer-shell">
      <header className="viewer-header">
        <div>
          <h1>{project.name}</h1>
          {project.client && <p className="viewer-sub">{project.client}</p>}
        </div>
        <button onClick={() => window.print()}>Print PDF</button>
      </header>

      <div className="stat-row">
        <div className="stat-card">
          <div className="stat-val">{stats.total}</div>
          <div className="stat-lbl">Total assets</div>
        </div>
        <div className="stat-card">
          <div className="stat-val">{stats.completed}</div>
          <div className="stat-lbl">Completed</div>
        </div>
        <div className="stat-card">
          <div className="stat-val">{stats.inProgress}</div>
          <div className="stat-lbl">In progress</div>
        </div>
        <div className="stat-card">
          <div className="stat-val">{stats.notStarted}</div>
          <div className="stat-lbl">Not started</div>
        </div>
      </div>
    </div>
  );
}
