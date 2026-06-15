// src/App.tsx
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/auth/AuthContext";
import { RequireAuth, RequireRole } from "@/auth/ProtectedRoute";
import LoginPage from "@/auth/LoginPage";

import { AppShell }              from "@/layout/AppShell";
import { DashboardPage }         from "@/features/dashboard/DashboardPage";
import { SupersetDashboardsPage } from "@/features/analytics/SupersetDashboardsPage";
import { OrganisationsPage }     from "@/features/admin/OrganisationsPage";
import { UsersPage }             from "@/features/admin/UsersPage";
import { ApprovalsPage }         from "@/features/admin/ApprovalsPage";
import { IntegrationsPage }      from "@/features/admin/IntegrationsPage";
import { AuditLogPage }          from "@/features/admin/AuditLogPage";
import { ApiKeysPage }           from "@/features/admin/ApiKeysPage";
import { ProfilePage }           from "@/features/profile/ProfilePage";
import { CollegesPage }          from "@/features/tippo/CollegesPage";
import { GdpMacroPage }          from "@/features/gdp/GdpMacroPage";
import { OverviewPage }          from "@/features/overview/OverviewPage";
import { NotFoundPage }          from "@/pages/NotFoundPage";
import UniversalImportPage from "@/features/import/UniversalImportPage";
import SchoolRatingForm from "@/features/schools/SchoolRatingForm";
import EduLevelPage from "@/features/edu-level/EduLevelPage";

function IndexRedirect() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user?.role === "data_entry") return <Navigate to="/edu/school" replace />;
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
              <Route path="/overview"   element={<OverviewPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/profile"   element={<ProfilePage />} />

              {/* Уровни образования */}
              <Route path="/edu/preschool"       element={<EduLevelPage level="do"    />} />
              <Route path="/edu/school"          element={<EduLevelPage level="so"    />} />
              <Route path="/edu/extracurricular" element={<EduLevelPage level="dopo"  />} />
              <Route path="/edu/college"         element={<EduLevelPage level="tippo" />} />
              <Route path="/edu/university"      element={<EduLevelPage level="vipo"  />} />

              {/* Алиасы старых маршрутов */}
              <Route path="/data/contingent" element={<Navigate to="/edu/school"      replace />} />
              <Route path="/data/finance"    element={<Navigate to="/edu/school"      replace />} />
              <Route path="/data/science"    element={<Navigate to="/edu/university"  replace />} />
              <Route path="/data/graduates"  element={<Navigate to="/edu/university"  replace />} />
              <Route path="/data/education"  element={<Navigate to="/edu/school"      replace />} />
              <Route path="/data/history"    element={<Navigate to="/edu/school"      replace />} />

              <Route path="/data/school-rating" element={<SchoolRatingForm />} />

              <Route path="/dashboards"     element={<SupersetDashboardsPage />} />

              {/* Оценка колледжей ТиПО */}
              <Route path="/tippo/colleges" element={<CollegesPage />} />

              {/* ВВП / Макроэффект */}
              <Route path="/analytics/gdp" element={<GdpMacroPage />} />

              <Route element={<RequireRole roles={["admin", "superadmin"]} />}>
                <Route path="/admin/organisations"    element={<OrganisationsPage />} />
                <Route path="/admin/users"            element={<UsersPage />} />
                <Route path="/admin/approvals"        element={<ApprovalsPage />} />
                <Route path="/admin/integrations"     element={<IntegrationsPage />} />
                <Route path="/admin/audit"            element={<AuditLogPage />} />
                <Route path="/admin/universal-import" element={<UniversalImportPage />} />
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
