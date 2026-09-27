import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useProjectRoles, type ProjectRole } from '../lib/useProjectRoles';
import { useProjectLocations } from '../lib/useProjectLocations';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import ProjectMapView from '../components/ProjectMapView';

interface ProjectPickerPageProps {
  basePath: '/admin' | '/field';
  allowedRoles: ProjectRole[];
  title: string;
}

export default function ProjectPickerPage({ basePath, allowedRoles, title }: ProjectPickerPageProps) {
  const { signOut } = useAuth();
  const { t } = useLanguage();
  const { roles, loading } = useProjectRoles();
  const [view, setView] = useState<'list' | 'map'>('list');

  const visible = roles.filter((r) => allowedRoles.includes(r.role));
  const isAdminSomewhere = roles.some((r) => r.role === 'admin');

  const { locations, loading: locationsLoading } = useProjectLocations(
    view === 'map' ? visible.map((r) => ({ id: r.project_id, coordinate_system: r.project.coordinate_system })) : [],
  );
  const mapEntries = visible
    .filter((r) => locations[r.project_id])
    .map((r) => ({ id: r.project_id, slug: r.project.slug, name: r.project.name, location: locations[r.project_id] }));
  const unlocatedCount = visible.length - mapEntries.length;

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

        {!loading && visible.length > 0 && (
          <div className="picker-view-toggle" role="tablist">
            <button
              type="button"
              className={view === 'list' ? 'active' : ''}
              onClick={() => setView('list')}
              role="tab"
              aria-selected={view === 'list'}
            >
              {t('picker.viewList')}
            </button>
            <button
              type="button"
              className={view === 'map' ? 'active' : ''}
              onClick={() => setView('map')}
              role="tab"
              aria-selected={view === 'map'}
            >
              {t('picker.viewMap')}
            </button>
          </div>
        )}

        {!loading && visible.length > 0 && view === 'list' && (
          <div className="picker-grid">
            {visible.map((r) => (
              <Link key={r.project_id} to={`${basePath}/${r.project.slug}`} className="picker-card">
                <span className="picker-card-name">{r.project.name}</span>
                <span className="picker-card-arrow">→</span>
              </Link>
            ))}
          </div>
        )}

        {!loading && visible.length > 0 && view === 'map' && (
          <div className="picker-map-wrap">
            {locationsLoading && <p className="wizard-hint">{t('picker.mapLoading')}</p>}
            {!locationsLoading && <ProjectMapView basePath={basePath} entries={mapEntries} />}
            {!locationsLoading && unlocatedCount > 0 && (
              <p className="picker-map-note">{t('picker.mapNoLocation').replace('{count}', String(unlocatedCount))}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
