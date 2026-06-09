// src/auth/ProtectedRoute.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Route guard components for React Router v6.
//
// Usage (in src/App.tsx):
//
//   <Routes>
//     <Route path="/login" element={<LoginPage />} />
//
//     {/* Any authenticated user */}
//     <Route element={<RequireAuth />}>
//       <Route path="/" element={<AppShell />}>
//         <Route index element={<DashboardPage />} />
//         <Route path="science" element={<SciencePage />} />
//       </Route>
//     </Route>
//
//     {/* Admin + superadmin only */}
//     <Route element={<RequireRole roles={["admin","superadmin"]} />}>
//       <Route path="/admin/users" element={<UsersPage />} />
//       <Route path="/admin/approvals" element={<ApprovalsPage />} />
//     </Route>
//
//     {/* Permission-based */}
//     <Route element={<RequirePermission permission="integrations.manage" />}>
//       <Route path="/admin/integrations" element={<IntegrationsPage />} />
//     </Route>
//   </Routes>
// ─────────────────────────────────────────────────────────────────────────────

import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import type { UserRole } from "@/auth/types";

// ── Full-screen spinner shown during the auth boot phase ──────────────────────
function BootLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-fc-pattern"
         style={{ background: "var(--surface-dark)" }}>
      <div className="flex flex-col items-center gap-4">
        <svg
          className="h-8 w-8 animate-spin text-fc-cyan-400"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-80" fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Восстановление сессии…</p>
      </div>
    </div>
  );
}

// ── 403 page ──────────────────────────────────────────────────────────────────
function Forbidden() {
  return (
    <div className="flex min-h-screen items-center justify-center"
         style={{ background: "var(--surface-dark)" }}>
      <div className="text-center space-y-3 max-w-sm px-4">
        <p className="text-5xl font-black tracking-fc-tight" style={{ color: "var(--text-muted)" }}>403</p>
        <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Доступ запрещён</p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          У вашей роли нет прав для просмотра этой страницы.
        </p>
      </div>
    </div>
  );
}

// ─── RequireAuth — any authenticated user ────────────────────────────────────

export function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <BootLoader />;

  if (!isAuthenticated) {
    // Preserve the attempted URL so we can redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

// ─── RequireRole — specific roles only ───────────────────────────────────────

export function RequireRole({
  roles,
  redirect = false,
}: {
  roles: UserRole[];
  /** If true, redirect to / instead of showing 403 */
  redirect?: boolean;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <BootLoader />;

  if (!user || !roles.includes(user.role)) {
    if (redirect) return <Navigate to="/" replace />;
    return <Forbidden />;
  }

  return <Outlet />;
}

// ─── RequirePermission — fine-grained permission check ───────────────────────

export function RequirePermission({
  permission,
  redirect = false,
}: {
  permission: string;
  redirect?: boolean;
}) {
  const { can, isLoading } = useAuth();

  if (isLoading) return <BootLoader />;

  if (!can(permission)) {
    if (redirect) return <Navigate to="/" replace />;
    return <Forbidden />;
  }

  return <Outlet />;
}
