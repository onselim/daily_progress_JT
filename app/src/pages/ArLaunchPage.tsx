import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { arProjectUrl } from '../lib/arLinks';

/** /ar/:slug — opens the AR page (public/ar-demo/hat/) for this project. That page loads the project's towers,
 * excavation tables and line KMZ itself by slug, so nothing is handed over here; an unknown slug is reported
 * there ("proje bulunamadı"). `replace` keeps the browser's Back button from bouncing straight back into AR. */
export default function ArLaunchPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useLanguage();

  useEffect(() => {
    if (slug) window.location.replace(arProjectUrl(slug));
  }, [slug]);

  return <div className="page-loading">{t('common.loading')}</div>;
}
