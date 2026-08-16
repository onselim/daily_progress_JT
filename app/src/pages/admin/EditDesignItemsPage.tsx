import { Link, useNavigate, useParams } from 'react-router-dom';
import { useProjectBySlug } from '../../lib/useProject';
import { ItemsEditor } from '../../components/ItemsEditor';

export default function EditDesignItemsPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { project, loading, error } = useProjectBySlug(slug);

  if (loading) return <div className="page-loading">Loading…</div>;
  if (error || !project) return <div className="page-loading">Project not found.</div>;

  return (
    <div className="project-shell">
      <header className="project-topbar">
        <div className="project-topbar-left">
          <Link to={`/admin/${project.slug}`}>← {project.name}</Link>
          <h1>Edit design items</h1>
        </div>
      </header>

      <div className="wizard-page">
        <ItemsEditor
          projectId={project.id}
          configKey="design_items"
          title="Design items"
          hint="Add or remove design items and adjust their weights. Removing an item redistributes its weight to the others; adding one takes a share from the rest — weights stay at 100 total automatically unless you edit them by hand afterward."
          onComplete={() => navigate(`/admin/${project.slug}`)}
        />
      </div>
    </div>
  );
}
