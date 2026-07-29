import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

export function ProtectedRoute() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="page-loading">Loading…</div>;
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />;

  return <Outlet />;
}
