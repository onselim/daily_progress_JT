import { Link, useNavigate, useParams } from 'react-router-dom';
import { useProjectBySlug } from '../../lib/useProject';
import { ItemsEditor } from '../../components/ItemsEditor';

export default function EditSupplyItemsPage() {
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
          <h1>Edit supply items</h1>
        </div>
      </header>

      <div className="wizard-page">
        <ItemsEditor
          projectId={project.id}
          configKey="supply_items"
          title="Supply items"
          hint="Add or remove materials and adjust their weights. Removing an item redistributes its weight to the others; adding one takes a share from the rest — weights stay at 100 total automatically unless you edit them by hand afterward. Each item is still tracked as Manufactured (2/3) + Delivered (1/3)."
          onComplete={() => navigate(`/admin/${project.slug}`)}
        />
      </div>
    </div>
  );
}
