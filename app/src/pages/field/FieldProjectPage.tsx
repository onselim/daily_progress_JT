import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { useProjectBySlug } from '../../lib/useProject';
import { useAssetStats } from '../../lib/useAssetStats';

export default function FieldProjectPage() {
  const { slug } = useParams<{ slug: string }>();
  const { signOut } = useAuth();
  const { project, loading, error } = useProjectBySlug(slug);
  const { stats } = useAssetStats(project?.id);

  if (loading) return <div className="page-loading">Loading…</div>;
  if (error || !project) return <div className="page-loading">Project not found.</div>;

  return (
    <div className="panel-shell">
      <header className="panel-header">
        <div>
          <Link to="/field">← Projects</Link>
          <h1>{project.name}</h1>
        </div>
        <button onClick={signOut}>Sign out</button>
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
      </div>

      <p>Daily log entry and photo upload land here next.</p>
    </div>
  );
}
