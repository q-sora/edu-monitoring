// src/App.tsx
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/auth/AuthContext";
import { RequireAuth, RequirePermission, RequireRole } from "@/auth/ProtectedRoute";
import LoginPage from "@/auth/LoginPage";

import {
  AppShell,
  DashboardPage,
  SupersetDashboardsPage,
  AnalyticsGlobalStatsPage,
  TransparencyPage,
  CoveragePage,
  ContingentPage, FinancePage, SciencePage, GraduatesPage, EducationPage, HistoryPage,
  CoefficientsPage,
  AIReportsPage,
  PresentationsPage,
  AnomaliesPage,
  OrganisationsPage, UsersPage, ApprovalsPage, IntegrationsPage, AuditLogPage, ApiKeysPage,
  ProfilePage,
  CollegesPage,
  NotFoundPage,
} from "@/portal";
import DataCatalogPage from "@/features/catalog/DataCatalogPage";
import UniversalImportPage from "@/features/import/UniversalImportPage";
import SchoolRatingForm from "@/features/schools/SchoolRatingForm";
import EduLevelPage from "@/features/edu-level/EduLevelPage";

function IndexRedirect() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user?.role === "data_entry") return <Navigate to="/edu/school" replace />;
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

              {/* Новые маршруты уровней образования */}
              <Route path="/edu/preschool"       element={<EduLevelPage level="do"    />} />
              <Route path="/edu/school"          element={<EduLevelPage level="so"    />} />
              <Route path="/edu/extracurricular" element={<EduLevelPage level="dopo"  />} />
              <Route path="/edu/college"         element={<EduLevelPage level="tippo" />} />
              <Route path="/edu/university"      element={<EduLevelPage level="vipo"  />} />
              <Route path="/edu/special"         element={<EduLevelPage level="gons"  />} />

              {/* Алиасы старых маршрутов */}
              <Route path="/data/contingent" element={<Navigate to="/edu/school" replace />} />
              <Route path="/data/finance"    element={<Navigate to="/edu/school" replace />} />
              <Route path="/data/science"    element={<Navigate to="/edu/university" replace />} />
              <Route path="/data/graduates"  element={<Navigate to="/edu/university" replace />} />
              <Route path="/data/education"  element={<Navigate to="/edu/school" replace />} />
              <Route path="/data/history"    element={<Navigate to="/edu/school" replace />} />

              <Route element={<RequirePermission permission="data.submit" />}>
                <Route path="/data/school-rating" element={<SchoolRatingForm />} />
              </Route>

              {/* Коэффициенты — Аналитика: admin/management видят рейтинг, data_entry вводят данные */}
              <Route element={<RequireRole roles={["superadmin", "admin", "management", "data_entry"]} />}>
                <Route path="/data/coefficients"  element={<CoefficientsPage />} />
              </Route>

              <Route path="/dashboards"              element={<SupersetDashboardsPage />} />
              <Route path="/analytics/global-stats" element={<AnalyticsGlobalStatsPage />} />

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

              {/* Каталог данных — все авторизованные */}
              <Route path="/catalog" element={<DataCatalogPage />} />

              {/* Универсальный импорт — admin/superadmin */}
              <Route element={<RequireRole roles={["admin", "superadmin"]} />}>
                <Route path="/admin/universal-import" element={<UniversalImportPage />} />
              </Route>

              {/* Оценка колледжей ТиППО — все авторизованные */}
              <Route path="/tippo/colleges" element={<CollegesPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
