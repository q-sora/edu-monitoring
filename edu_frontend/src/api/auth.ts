// src/api/auth.ts
// ─────────────────────────────────────────────────────────────────────────────
// Typed API functions for auth endpoints.
// These are thin wrappers around the axios client.
// The AuthContext uses these functions internally.
// ─────────────────────────────────────────────────────────────────────────────

import client from "@/api/client";
import type { LoginResponse, RefreshResponse, UserProfile } from "@/auth/types";

export interface RegisterUserPayload {
  email:    string;
  password: string;
  full_name: string;
  role:     string;
  org_id?:  string | null;
  phone?:   string | null;
}

/** POST /auth/login */
export async function apiLogin(email: string, password: string): Promise<LoginResponse> {
  const { data } = await client.post<LoginResponse>("/auth/login", { email, password });
  return data;
}

/** POST /auth/refresh — uses httpOnly cookie automatically */
export async function apiRefresh(): Promise<RefreshResponse> {
  const { data } = await client.post<RefreshResponse>("/auth/refresh");
  return data;
}

/** POST /auth/logout */
export async function apiLogout(): Promise<void> {
  await client.post("/auth/logout");
}

/** GET /auth/me */
export async function apiMe(): Promise<UserProfile> {
  const { data } = await client.get<UserProfile>("/auth/me");
  return data;
}

/** POST /auth/change-password */
export async function apiChangePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await client.post("/auth/change-password", {
    current_password: currentPassword,
    new_password:     newPassword,
  });
}

/** POST /auth/register  (admin/superadmin only) */
export async function apiRegisterUser(payload: RegisterUserPayload): Promise<UserProfile> {
  const { data } = await client.post<UserProfile>("/auth/register", payload);
  return data;
}
