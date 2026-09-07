import { Link } from 'react-router-dom';
import { useLanguage } from '../lib/i18n/LanguageContext';

export default function HomePage() {
  const { t } = useLanguage();
  return (
    <div className="panel-shell">
      <h1>{t('home.title')}</h1>
      <p>{t('home.reportLinkHint', { example: '/jvari-tskaltubo' })}</p>
      <p>
        <Link to="/login">{t('home.signInLink')}</Link>
      </p>
    </div>
  );
}
