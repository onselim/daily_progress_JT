import { useLanguage } from '../lib/i18n/LanguageContext';

export default function NotFoundPage() {
  const { t } = useLanguage();
  return (
    <div className="page-loading">
      <p>{t('notFound.title')}</p>
    </div>
  );
}
