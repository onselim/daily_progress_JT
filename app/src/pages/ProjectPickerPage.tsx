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
    <div className="panel-shell">
      <header className="panel-header">
        <h1>{title}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {basePath === '/admin' && isAdminSomewhere && <Link to="/admin/new">+ New project</Link>}
          <button onClick={signOut}>Sign out</button>
        </div>
      </header>

      {loading && <p>Loading your projects…</p>}

      {!loading && visible.length === 0 && (
        <p>No projects are assigned to your account yet. Ask an admin to invite you.</p>
      )}

      <ul className="project-list">
        {visible.map((r) => (
          <li key={r.project_id}>
            <Link to={`${basePath}/${r.project.slug}`}>{r.project.name}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
