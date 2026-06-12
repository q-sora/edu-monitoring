// src/auth/AuthContext.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Native auth context — no Supabase, no external provider.
//
// Responsibilities:
//   • Login: POST /auth/login, store access token in memory, schedule refresh
//   • Logout: POST /auth/logout, clear token and user state
//   • Bootstrap: on app load, try POST /auth/refresh to silently recover a
//     session from the httpOnly cookie (handles page reload gracefully)
//   • Expose: user profile, isAuthenticated, isLoading, can(), canForOrg()
//   • Listen: to the AUTH_LOGOUT_EVENT dispatched by the Axios interceptor
//             when a refresh fails mid-session (token expired, server restart)
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import client, { AUTH_LOGOUT_EVENT, silentRefresh } from "@/api/client";
import {
  clearToken,
  isAuthenticated as tokenIsAuth,
  scheduleRefresh,
  setToken,
} from "@/auth/tokenStore";
import type { LoginResponse, UserProfile } from "@/auth/types";
import { can as checkPermission } from "@/auth/types";

// ─── Context shape ────────────────────────────────────────────────────────────

interface AuthContextValue {
  /** Current logged-in user, or null if not authenticated. */
  user: UserProfile | null;
  /** True while the initial session restore is in progress. */
  isLoading: boolean;
  /** True once at least one successful login or refresh has occurred. */
  isAuthenticated: boolean;
  /**
   * Authenticate with email + password.
   * Returns null on success, or an error message string on failure.
   */
  login: (email: string, password: string) => Promise<string | null>;
  /** Log out: revoke tokens on the server, clear local state. */
  logout: () => Promise<void>;
  /**
   * Check if the current user has the given permission.
   * Permission list mirrors backend ROLE_PERMISSIONS.
   */
  can: (permission: string) => boolean;
  /**
   * Check org isolation for data_entry users.
   * Admin / superadmin always return true.
   * data_entry returns true only when orgId matches their own org.
   */
  canForOrg: (orgId: string) => boolean;
}

// ─── Context object ───────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<UserProfile | null>(null);
  const [isLoading, setLoading] = useState(true);   // start true → boot phase
  const didBootRef = useRef(false);                  // prevent double-boot in StrictMode

  // ── Boot: try to recover a session from the httpOnly refresh cookie ────────
  useEffect(() => {
    if (didBootRef.current) return;
    didBootRef.current = true;

    const boot = async () => {
      try {
        // If a valid refresh cookie exists, the server returns a new access token
        const resp = await client.post<{ access_token: string; expires_in: number; user?: UserProfile }>(
          "/auth/refresh"
        );
        const { access_token, expires_in } = resp.data;
        setToken(access_token, expires_in);
        scheduleRefresh(expires_in, silentRefresh);

        // Fetch the full user profile with the new token
        const meResp = await client.get<UserProfile>("/auth/me");
        setUser(meResp.data);
      } catch {
        // No valid session — user must log in manually (expected on fresh browser)
        clearToken();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    boot();
  }, []);

  // ── Listen for forced logout from Axios interceptor ────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const reason = (e as CustomEvent<{ reason: string }>).detail?.reason;
      console.info("Auth logout event:", reason);
      setUser(null);
      clearToken();
    };
    window.addEventListener(AUTH_LOGOUT_EVENT, handler);
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, handler);
  }, []);

  // ── Login ──────────────────────────────────────────────────────────────────
  const login = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      try {
        const resp = await client.post<LoginResponse>("/auth/login", {
          email: email.toLowerCase().trim(),
          password,
        });
        const { access_token, expires_in, user: profile } = resp.data;

        setToken(access_token, expires_in);
        scheduleRefresh(expires_in, silentRefresh);
        setUser(profile);
        return null;   // success

      } catch (err: unknown) {
        clearToken();
        setUser(null);

        if (
          typeof err === "object" &&
          err !== null &&
          "response" in err &&
          typeof (err as { response?: { data?: { detail?: string }; status?: number } }).response === "object"
        ) {
          const detail =
            (err as { response: { data?: { detail?: string }; status: number } })
              .response?.data?.detail;
          const status =
            (err as { response: { status: number } }).response?.status;

          if (status === 423) return detail ?? "Аккаунт временно заблокирован.";
          if (status === 429) return detail ?? "Слишком много попыток. Подождите.";
          if (detail) return detail;
        }

        return "Неверный email или пароль.";
      }
    },
    [],
  );

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(async (): Promise<void> => {
    try {
      await client.post("/auth/logout");
    } catch {
      // Ignore errors — server might already have invalidated the token
    } finally {
      clearToken();
      setUser(null);
    }
  }, []);

  // ── Permission helper ──────────────────────────────────────────────────────
  const can = useCallback(
    (permission: string): boolean => {
      return user ? checkPermission(user.role, permission) : false;
    },
    [user],
  );

  const canForOrg = useCallback(
    (orgId: string): boolean => {
      if (!user) return false;
      if (can("data.view_all")) return true;  // admin / superadmin bypass
      return user.org_id === orgId;
    },
    [user, can],
  );

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: tokenIsAuth() && user !== null,
    login,
    logout,
    can,
    canForOrg,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

// ─── Gate components ──────────────────────────────────────────────────────────

/**
 * Render children only if the current user has `requires` permission.
 * Usage: <PermissionGate requires="data.approve"><ApproveButton/></PermissionGate>
 */
export function PermissionGate({
  requires,
  children,
  fallback = null,
}: {
  requires: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { can: canDo } = useAuth();
  return <>{canDo(requires) ? children : fallback}</>;
}

/**
 * Render children only if the current user's org matches orgId.
 * Admin/superadmin always pass.
 */
export function OrgGate({
  orgId,
  children,
  fallback = null,
}: {
  orgId: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { canForOrg } = useAuth();
  return <>{canForOrg(orgId) ? children : fallback}</>;
}
