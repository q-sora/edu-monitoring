// src/App.tsx
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/auth/AuthContext";
import { RequireAuth } from "@/auth/ProtectedRoute";
import LoginPage from "@/auth/LoginPage";

import { AppShell }               from "@/layout/AppShell";
import { ProfilePage }            from "@/features/profile/ProfilePage";
import { CollegesPage }           from "@/features/tippo/CollegesPage";
import { GdpMacroPage }           from "@/features/gdp/GdpMacroPage";
import { ChainBreaksPage }        from "@/features/chain/ChainBreaksPage";
import { RoiGraduatePage }        from "@/features/roi/RoiGraduatePage";
import { TrajectoryPage }         from "@/features/trajectory/TrajectoryPage";
import { CompareEduLevelsPage }   from "@/features/compare/CompareEduLevelsPage";
import { ItDataPage }             from "@/features/itdata/ItDataPage";
import { OverviewPage }           from "@/features/overview/OverviewPage";
import { NotFoundPage }           from "@/pages/NotFoundPage";
import EduLevelPage     from "@/features/edu-level/EduLevelPage";
import PreschoolPage    from "@/features/edu-level/PreschoolPage";
import SchoolPage       from "@/features/edu-level/SchoolPage";
import TippoPage        from "@/features/edu-level/TippoPage";
import DopoPage         from "@/features/edu-level/DopoPage";
import VipoPage         from "@/features/edu-level/VipoPage";

function IndexRedirect() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user?.role === "data_entry") return <Navigate to="/edu/school" replace />;
  return <Navigate to="/overview" replace />;
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
              <Route path="/overview"  element={<OverviewPage />} />
              <Route path="/profile"   element={<ProfilePage />} />

              {/* Уровни образования */}
              <Route path="/edu/preschool"       element={<PreschoolPage />} />
              <Route path="/edu/school"          element={<SchoolPage />} />
              <Route path="/edu/extracurricular" element={<DopoPage />} />
              <Route path="/edu/college"         element={<TippoPage />} />
              <Route path="/edu/university"      element={<VipoPage />} />

              {/* Алиасы старых маршрутов */}
              <Route path="/data/contingent" element={<Navigate to="/edu/school"     replace />} />
              <Route path="/data/finance"    element={<Navigate to="/edu/school"     replace />} />
              <Route path="/data/science"    element={<Navigate to="/edu/university" replace />} />
              <Route path="/data/graduates"  element={<Navigate to="/edu/university" replace />} />
              <Route path="/data/education"  element={<Navigate to="/edu/school"     replace />} />
              <Route path="/data/history"    element={<Navigate to="/edu/school"     replace />} />

              {/* Оценка колледжей ТиПО */}
              <Route path="/tippo/colleges" element={<CollegesPage />} />

              {/* ВВП / Макроэффект */}
              <Route path="/analytics/gdp"   element={<GdpMacroPage />} />
              <Route path="/analytics/chain" element={<ChainBreaksPage />} />
              <Route path="/analytics/roi"        element={<RoiGraduatePage />} />
              <Route path="/analytics/trajectory" element={<TrajectoryPage />} />
              <Route path="/analytics/compare"    element={<CompareEduLevelsPage />} />
              <Route path="/analytics/itdata"    element={<ItDataPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}


