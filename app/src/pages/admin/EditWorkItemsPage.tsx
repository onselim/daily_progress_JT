import { Link, useNavigate, useParams } from 'react-router-dom';
import { useProjectBySlug } from '../../lib/useProject';
import { useWorkItemsConfig } from '../../lib/useProjectConfig';
import { useLanguage } from '../../lib/i18n/LanguageContext';
import { WorkItemsStep } from '../../components/wizard/WorkItemsStep';

export default function EditWorkItemsPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { project, loading: projectLoading, error } = useProjectBySlug(slug);
  const { workItems, loading: workItemsLoading } = useWorkItemsConfig(project?.id);

  if (projectLoading || workItemsLoading) return <div className="page-loading">{t('common.loading')}</div>;
  if (error || !project) return <div className="page-loading">{t('common.projectNotFound')}</div>;

  return (
    <div className="project-shell">
      <header className="project-topbar">
        <div className="project-topbar-left">
          <Link to={`/admin/${project.slug}`}>← {project.name}</Link>
          <h1>{t('items.editWorkItemsTitle')}</h1>
        </div>
      </header>

      <div className="wizard-page">
        <WorkItemsStep
          projectId={project.id}
          initialItems={workItems}
          title={t('assetEditor.workItems')}
          submitLabel={t('common.save')}
          onComplete={() => navigate(`/admin/${project.slug}`)}
        />
      </div>
    </div>
  );
}
