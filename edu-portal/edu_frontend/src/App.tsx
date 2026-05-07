// src/App.tsx
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/auth/AuthContext";
import { RequireAuth, RequirePermission, RequireRole } from "@/auth/ProtectedRoute";
import LoginPage from "@/auth/LoginPage";

import {
  AppShell,
  DashboardPage,
  SupersetDashboardsPage,
  TransparencyPage,
  CoveragePage,
  ContingentPage, FinancePage, SciencePage, GraduatesPage, EducationPage, HistoryPage,
  CoefficientsPage,
  AIReportsPage,
  PresentationsPage,
  AnomaliesPage,
  OrganisationsPage, UsersPage, ApprovalsPage, IntegrationsPage, AuditLogPage, ApiKeysPage,
  ProfilePage,
  NotFoundPage,
} from "@/portal";

function IndexRedirect() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user?.role === "data_entry") return <Navigate to="/data/contingent" replace />;
  if (user?.role === "management") return <Navigate to="/transparency" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<IndexRedirect />} />

          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route path="/dashboard"    element={<DashboardPage />} />
              <Route path="/transparency" element={<TransparencyPage />} />
              <Route path="/profile"      element={<ProfilePage />} />

              <Route element={<RequireRole roles={["admin", "superadmin"]} />}>
                <Route path="/coverage" element={<CoveragePage />} />
              </Route>

              <Route element={<RequirePermission permission="data.submit" />}>
                <Route path="/data/contingent"    element={<ContingentPage />} />
                <Route path="/data/finance"       element={<FinancePage />} />
                <Route path="/data/science"       element={<SciencePage />} />
                <Route path="/data/graduates"     element={<GraduatesPage />} />
                <Route path="/data/education"     element={<EducationPage />} />
                <Route path="/data/history"       element={<HistoryPage />} />
              </Route>

              {/* Коэффициенты — Аналитика: admin/management видят рейтинг, data_entry вводят данные */}
              <Route element={<RequireRole roles={["superadmin", "admin", "management", "data_entry"]} />}>
                <Route path="/data/coefficients"  element={<CoefficientsPage />} />
              </Route>

              <Route path="/dashboards" element={<SupersetDashboardsPage />} />

              <Route element={<RequirePermission permission="ai_insights.view" />}>
                <Route path="/reports"        element={<AIReportsPage />} />
                <Route path="/presentations"  element={<PresentationsPage />} />
                <Route path="/anomalies"      element={<AnomaliesPage />} />
              </Route>

              <Route element={<RequireRole roles={["admin", "superadmin"]} />}>
                <Route path="/admin/organisations" element={<OrganisationsPage />} />
                <Route path="/admin/users"         element={<UsersPage />} />
                <Route path="/admin/approvals"     element={<ApprovalsPage />} />
                <Route path="/admin/integrations"  element={<IntegrationsPage />} />
                <Route path="/admin/audit"         element={<AuditLogPage />} />
              </Route>

              <Route element={<RequireRole roles={["superadmin"]} />}>
                <Route path="/admin/api-keys" element={<ApiKeysPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
