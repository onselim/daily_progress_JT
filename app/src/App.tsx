import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import { LanguageProvider } from './lib/i18n/LanguageContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RequireProjectRole } from './components/RequireProjectRole';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import AcceptInvitePage from './pages/AcceptInvitePage';
import ProjectPickerPage from './pages/ProjectPickerPage';
import AdminProjectPage from './pages/admin/AdminProjectPage';
import NewProjectPage from './pages/admin/NewProjectPage';
import EditWorkItemsPage from './pages/admin/EditWorkItemsPage';
import EditDesignItemsPage from './pages/admin/EditDesignItemsPage';
import EditSupplyItemsPage from './pages/admin/EditSupplyItemsPage';
import ReportSettingsPage from './pages/admin/ReportSettingsPage';
import TeamPage from './pages/admin/TeamPage';
import FieldProjectPage from './pages/field/FieldProjectPage';
import PublicViewerPage from './pages/PublicViewerPage';
import PrintReportPage from './pages/PrintReportPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <LanguageProvider>
    <AuthProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/accept-invite" element={<AcceptInvitePage />} />

        <Route element={<ProtectedRoute />}>
          <Route
            path="/admin"
            element={
              <ProjectPickerPage basePath="/admin" allowedRoles={['admin']} title="Admin — your projects" />
            }
          />
          <Route
            path="/field"
            element={
              <ProjectPickerPage
                basePath="/field"
                allowedRoles={['field_engineer']}
                title="Field engineer — your projects"
              />
            }
          />

          <Route element={<RequireProjectRole allowedRoles={['admin']} />}>
            <Route path="/admin/new" element={<NewProjectPage />} />
            <Route path="/admin/:slug/work-items" element={<EditWorkItemsPage />} />
            <Route path="/admin/:slug/design-items" element={<EditDesignItemsPage />} />
            <Route path="/admin/:slug/supply-items" element={<EditSupplyItemsPage />} />
            <Route path="/admin/:slug/report-settings" element={<ReportSettingsPage />} />
            <Route path="/admin/:slug/team" element={<TeamPage />} />
            <Route path="/admin/:slug" element={<AdminProjectPage />} />
          </Route>

          <Route element={<RequireProjectRole allowedRoles={['admin', 'field_engineer']} />}>
            <Route path="/field/:slug" element={<FieldProjectPage />} />
          </Route>
        </Route>

        <Route path="/print/:slug" element={<PrintReportPage />} />
        <Route path="/reports/:slug" element={<PublicViewerPage />} />
        <Route path="/:slug" element={<PublicViewerPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
    </LanguageProvider>
  );
}
