import { Link, useNavigate, useParams } from 'react-router-dom';
import { useProjectBySlug } from '../../lib/useProject';
import { useWorkItemsConfig } from '../../lib/useProjectConfig';
import { WorkItemsStep } from '../../components/wizard/WorkItemsStep';

export default function EditWorkItemsPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { project, loading: projectLoading, error } = useProjectBySlug(slug);
  const { workItems, loading: workItemsLoading } = useWorkItemsConfig(project?.id);

  if (projectLoading || workItemsLoading) return <div className="page-loading">Loading…</div>;
  if (error || !project) return <div className="page-loading">Project not found.</div>;

  return (
    <div className="project-shell">
      <header className="project-topbar">
        <div className="project-topbar-left">
          <Link to={`/admin/${project.slug}`}>← {project.name}</Link>
          <h1>Edit work items</h1>
        </div>
      </header>

      <div className="wizard-page">
        <WorkItemsStep
          projectId={project.id}
          initialItems={workItems}
          title="Work items"
          submitLabel="Save"
          onComplete={() => navigate(`/admin/${project.slug}`)}
        />
      </div>
    </div>
  );
}
