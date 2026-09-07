import { Link, useNavigate, useParams } from 'react-router-dom';
import { useProjectBySlug } from '../../lib/useProject';
import { ItemsEditor } from '../../components/ItemsEditor';
import { useLanguage } from '../../lib/i18n/LanguageContext';

export default function EditDesignItemsPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { project, loading, error } = useProjectBySlug(slug);

  if (loading) return <div className="page-loading">{t('common.loading')}</div>;
  if (error || !project) return <div className="page-loading">{t('common.projectNotFound')}</div>;

  return (
    <div className="project-shell">
      <header className="project-topbar">
        <div className="project-topbar-left">
          <Link to={`/admin/${project.slug}`}>← {project.name}</Link>
          <h1>{t('items.editDesignItemsTitle')}</h1>
        </div>
      </header>

      <div className="wizard-page">
        <ItemsEditor
          projectId={project.id}
          configKey="design_items"
          title={t('items.designItemsTitle')}
          hint={t('items.designItemsHint')}
          onComplete={() => navigate(`/admin/${project.slug}`)}
        />
      </div>
    </div>
  );
}
