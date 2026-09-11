import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useProjectRoles, type ProjectRole } from '../lib/useProjectRoles';
import { useLanguage } from '../lib/i18n/LanguageContext';

interface RequireProjectRoleProps {
  allowedRoles: ProjectRole[];
}

/** Route-level guard on top of RLS: without a `:slug` param (e.g. `/admin/new`) checks
 * whether the user holds one of `allowedRoles` on ANY project; with a `:slug`, checks
 * that specific project. RLS already blocks the underlying reads/writes either way --
 * this just keeps the wrong role from ever seeing the page at all. */
export function RequireProjectRole({ allowedRoles }: RequireProjectRoleProps) {
  const { slug } = useParams<{ slug?: string }>();
  const { roles, loading } = useProjectRoles();
  const { t } = useLanguage();

  if (loading) return <div className="page-loading">{t('common.loading')}</div>;

  const authorized = slug
    ? roles.some((r) => r.project.slug === slug && allowedRoles.includes(r.role))
    : roles.some((r) => allowedRoles.includes(r.role));

  if (!authorized) {
    const fallback = roles.some((r) => r.role === 'admin')
      ? '/admin'
      : roles.some((r) => r.role === 'field_engineer')
        ? '/field'
        : '/';
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
}
