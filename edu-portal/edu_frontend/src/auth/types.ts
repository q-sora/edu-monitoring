// src/auth/types.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared type definitions for the native auth system.
// These mirror the FastAPI Pydantic response models exactly.
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole = "superadmin" | "admin" | "management" | "data_entry";

/** Mirrors FastAPI UserProfile schema */
export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  org_id: string | null;
  must_change_password: boolean;
}

/** Mirrors FastAPI LoginResponse schema */
export interface LoginResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;   // seconds
  user: UserProfile;
}

/** Mirrors FastAPI RefreshResponse schema */
export interface RefreshResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
}

// ─── RBAC permission matrix (mirrors backend ROLE_PERMISSIONS) ───────────────

const ROLE_PERMISSIONS: Record<UserRole, Set<string>> = {
  superadmin: new Set(["*"]),
  admin: new Set([
    "users.view", "users.create", "users.edit", "users.delete", "users.assign_role",
    "data.view_all", "data.approve", "data.reject", "data.export",
    "integrations.view", "integrations.manage", "integrations.trigger",
    "reports.view", "audit.view", "ai_insights.view", "organizations.manage",
  ]),
  management: new Set(["reports.view", "audit.view", "ai_insights.view", "data.view_all"]),
  data_entry: new Set(["data.submit", "data.view_own", "data.edit_draft"]),
};

export function can(role: UserRole | undefined, permission: string): boolean {
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  return perms.has("*") || perms.has(permission);
}

export const ROLE_META: Record<UserRole, { label: string; color: string }> = {
  superadmin: { label: "Суперадмин",    color: "text-violet-700 bg-violet-100 border-violet-200" },
  admin:      { label: "Администратор", color: "text-blue-700 bg-blue-100 border-blue-200" },
  management: { label: "Руководство",   color: "text-emerald-700 bg-emerald-100 border-emerald-200" },
  data_entry: { label: "Ввод данных",   color: "text-amber-700 bg-amber-100 border-amber-200" },
};
