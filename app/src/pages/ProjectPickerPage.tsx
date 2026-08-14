import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useProjectRoles, type ProjectRole } from '../lib/useProjectRoles';

interface ProjectPickerPageProps {
  basePath: '/admin' | '/field';
  allowedRoles: ProjectRole[];
  title: string;
}

export default function ProjectPickerPage({ basePath, allowedRoles, title }: ProjectPickerPageProps) {
  const { signOut } = useAuth();
  const { roles, loading } = useProjectRoles();

  const visible = roles.filter((r) => allowedRoles.includes(r.role));
  const isAdminSomewhere = roles.some((r) => r.role === 'admin');

  return (
    <div className="project-shell">
      <div className="picker-content">
        <header className="picker-header">
          <h1>{title}</h1>
          <div className="picker-actions">
            {basePath === '/admin' && isAdminSomewhere && (
              <Link to="/admin/new" className="picker-new-btn">
                + New project
              </Link>
            )}
            <button onClick={signOut}>Sign out</button>
          </div>
        </header>

        {loading && <p className="wizard-hint">Loading your projects…</p>}

        {!loading && visible.length === 0 && (
          <p className="wizard-hint">No projects are assigned to your account yet. Ask an admin to invite you.</p>
        )}

        <div className="picker-grid">
          {visible.map((r) => (
            <Link key={r.project_id} to={`${basePath}/${r.project.slug}`} className="picker-card">
              <span className="picker-card-name">{r.project.name}</span>
              <span className="picker-card-arrow">→</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
