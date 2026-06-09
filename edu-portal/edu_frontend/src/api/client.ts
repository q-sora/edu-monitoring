// src/api/client.ts
// ─────────────────────────────────────────────────────────────────────────────
// Axios instance wired to the FastAPI backend.
//
// Interceptor pipeline:
//
//   Request:
//     1. Attach Authorization: Bearer <access_token> from in-memory store.
//        If no token is present, the request still goes through — the server
//        returns 401, triggering the response interceptor.
//
//   Response (success):
//     Pass through.
//
//   Response (401 Unauthorized):
//     1. If this is already a retry, give up → dispatch logout event.
//     2. Try POST /auth/refresh (uses the httpOnly cookie automatically
//        because withCredentials: true is set on the client).
//     3. On refresh success: store new access token, retry the original request.
//     4. On refresh failure: dispatch logout event, reject with original error.
//
// The logout event is dispatched on window so that AuthContext can react
// (redirect to login, clear user state) from anywhere in the component tree
// without a circular import.
// ─────────────────────────────────────────────────────────────────────────────

import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { clearToken, getToken, scheduleRefresh, setToken } from "@/auth/tokenStore";
import type { RefreshResponse } from "@/auth/types";

// ── Config ────────────────────────────────────────────────────────────────────

// const API_BASE = "http://192.168.13.245:8000/api/v1";

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : "/api/v1";   // fallback: same origin (nginx reverse proxy in production)

// ── Custom event used to signal auth failure to the React tree ────────────────

export const AUTH_LOGOUT_EVENT = "edu:auth:logout" as const;

function dispatchLogout(reason: string = "session_expired"): void {
  window.dispatchEvent(new CustomEvent(AUTH_LOGOUT_EVENT, { detail: { reason } }));
}

// ── Axios instance ─────────────────────────────────────────────────────────────

const client: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 20_000,        // 20 s — generous for JSONB-heavy payloads
  withCredentials: true,  // CRITICAL: send httpOnly refresh cookie on every request
  headers: {
    "Content-Type": "application/json",
    "Accept":       "application/json",
  },
});

// ── Request interceptor — attach Bearer token ─────────────────────────────────

client.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Attach a unique request ID for server-side log correlation
    config.headers["X-Request-ID"] = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response interceptor — handle 401 with token refresh ─────────────────────

// Flag to prevent multiple simultaneous refresh calls
let isRefreshing = false;
// Queue of callbacks waiting for the refreshed token
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject:  (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null): void {
  failedQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(error);
  });
  failedQueue = [];
}

interface OriginalRequest extends AxiosRequestConfig {
  _retry?: boolean;
}

client.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as OriginalRequest | undefined;

    // Only intercept 401 Unauthorized responses
    if (!error.response || error.response.status !== 401) {
      return Promise.reject(error);
    }

    // If this is a refresh call itself failing → logout immediately
    if (originalRequest?.url?.includes("/auth/refresh")) {
      clearToken();
      dispatchLogout("refresh_failed");
      return Promise.reject(error);
    }

    // If already retried, don't loop
    if (originalRequest?._retry) {
      dispatchLogout("retry_failed");
      return Promise.reject(error);
    }

    if (!originalRequest) return Promise.reject(error);

    // If another refresh is in-flight, queue this request
    if (isRefreshing) {
      return new Promise<AxiosResponse>((resolve, reject) => {
        failedQueue.push({
          resolve: (newToken: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            resolve(client(originalRequest));
          },
          reject,
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // Call the refresh endpoint — the httpOnly cookie is sent automatically
      const resp = await client.post<RefreshResponse>("/auth/refresh");
      const { access_token, expires_in } = resp.data;

      setToken(access_token, expires_in);
      scheduleRefresh(expires_in, silentRefresh);
      processQueue(null, access_token);

      // Retry the original failed request with the new token
      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
      }
      return client(originalRequest);

    } catch (refreshError) {
      processQueue(refreshError, null);
      clearToken();
      dispatchLogout("session_expired");
      return Promise.reject(refreshError);

    } finally {
      isRefreshing = false;
    }
  },
);

// ── Silent refresh (scheduled by tokenStore.scheduleRefresh) ─────────────────

async function silentRefresh(): Promise<void> {
  const resp = await client.post<RefreshResponse>("/auth/refresh");
  const { access_token, expires_in } = resp.data;
  setToken(access_token, expires_in);
  scheduleRefresh(expires_in, silentRefresh);
}

export { silentRefresh };
export default client;
