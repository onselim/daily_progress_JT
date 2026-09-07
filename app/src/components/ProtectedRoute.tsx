import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useLanguage } from '../lib/i18n/LanguageContext';

export function ProtectedRoute() {
  const { session, loading } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();

  if (loading) return <div className="page-loading">{t('common.loading')}</div>;
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />;

  return <Outlet />;
}
