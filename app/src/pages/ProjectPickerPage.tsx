import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useProjectRoles, type ProjectRole } from '../lib/useProjectRoles';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

interface ProjectPickerPageProps {
  basePath: '/admin' | '/field';
  allowedRoles: ProjectRole[];
  title: string;
}

export default function ProjectPickerPage({ basePath, allowedRoles, title }: ProjectPickerPageProps) {
  const { signOut } = useAuth();
  const { t } = useLanguage();
  const { roles, loading } = useProjectRoles();

  const visible = roles.filter((r) => allowedRoles.includes(r.role));
  const isAdminSomewhere = roles.some((r) => r.role === 'admin');

  return (
    <div className="project-shell">
      <div className="picker-content">
        <header className="picker-header">
          <h1>{title}</h1>
          <div className="picker-actions">
            <LanguageSwitcher />
            {basePath === '/admin' && isAdminSomewhere && (
              <Link to="/admin/new" className="picker-new-btn">
                {t('picker.newProject')}
              </Link>
            )}
            <button onClick={signOut}>{t('common.signOut')}</button>
          </div>
        </header>

        {loading && <p className="wizard-hint">{t('picker.loadingProjects')}</p>}

        {!loading && visible.length === 0 && <p className="wizard-hint">{t('picker.noProjects')}</p>}

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
