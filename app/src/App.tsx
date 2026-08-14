import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import ProjectPickerPage from './pages/ProjectPickerPage';
import AdminProjectPage from './pages/admin/AdminProjectPage';
import NewProjectPage from './pages/admin/NewProjectPage';
import EditWorkItemsPage from './pages/admin/EditWorkItemsPage';
import FieldProjectPage from './pages/field/FieldProjectPage';
import PublicViewerPage from './pages/PublicViewerPage';
import PrintReportPage from './pages/PrintReportPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route
            path="/admin"
            element={
              <ProjectPickerPage basePath="/admin" allowedRoles={['admin']} title="Admin — your projects" />
            }
          />
          <Route path="/admin/new" element={<NewProjectPage />} />
          <Route path="/admin/:slug/work-items" element={<EditWorkItemsPage />} />
          <Route path="/admin/:slug" element={<AdminProjectPage />} />

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
          <Route path="/field/:slug" element={<FieldProjectPage />} />
        </Route>

        <Route path="/print/:slug" element={<PrintReportPage />} />
        <Route path="/reports/:slug" element={<PublicViewerPage />} />
        <Route path="/:slug" element={<PublicViewerPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}
