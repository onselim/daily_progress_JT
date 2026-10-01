import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useProjectBySlug } from '../lib/useProject';
import { useAssets } from '../lib/useAssets';
import { useActiveAssetIds } from '../lib/useActiveAssetIds';
import { useRestrictedToday } from '../lib/useRestrictedToday';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { buildArPayload, launchAr } from '../lib/arPayload';
import { STATUS_COLOR } from '../lib/mapConstants';

/** /ar/:slug — hands the project's towers (coordinates + construction status) to the AR page and opens it.
 * Deliberately a separate, additive page: nothing in the existing topbars or panels changes. */
export default function ArLaunchPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t, n } = useLanguage();
  const { project, loading, error } = useProjectBySlug(slug);
  const { assets, loading: assetsLoading } = useAssets(project?.id);
  const { activeAssetIds } = useActiveAssetIds(project?.id);
  const { restrictedAssetIds } = useRestrictedToday(project?.id);

  const payload = useMemo(
    () => (project ? buildArPayload(project, assets, activeAssetIds, restrictedAssetIds) : null),
    [project, assets, activeAssetIds, restrictedAssetIds],
  );

  if (loading || (project && assetsLoading)) return <div className="page-loading">{t('common.loading')}</div>;
  if (error || !project || !payload) {
    return (
      <div className="page-loading">
        <p>{t('topbar.reportNotAvailable')}</p>
      </div>
    );
  }

  const count = (status: string) => payload.assets.filter((a) => a.s === status).length;
  const legend: { key: string; label: string }[] = [
    { key: 'not_started', label: t('status.notStarted') },
    { key: 'in_progress', label: t('status.inProgress') },
    { key: 'completed', label: t('status.completed') },
    { key: 'on_hold', label: t('arLaunch.onHold') },
  ];

  return (
    <div className="project-shell">
      <div className="picker-content">
        <header className="picker-header">
          <h1>
            {t('arLaunch.title')} — {project.name}
          </h1>
          <div className="picker-actions">
            <LanguageSwitcher />
            <Link to={`/${project.slug}`} className="picker-new-btn">
              {t('common.back')}
            </Link>
          </div>
        </header>

        <p className="wizard-hint">{t('arLaunch.intro')}</p>

        {payload.assets.length === 0 ? (
          <p className="wizard-hint">{t('arLaunch.noCoords')}</p>
        ) : (
          <>
            <p className="wizard-hint">{t('arLaunch.towersReady', { count: n(payload.assets.length) })}</p>
            <ul className="ar-launch-legend">
              {legend.map((l) => (
                <li key={l.key}>
                  <span className="ar-launch-dot" style={{ background: STATUS_COLOR[l.key] }} />
                  {l.label}: {n(count(l.key))}
                </li>
              ))}
            </ul>
            <button className="ar-launch-btn" onClick={() => launchAr(payload)}>
              📱 {t('arLaunch.open')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
