// src/auth/tokenStore.ts
// ─────────────────────────────────────────────────────────────────────────────
// In-memory access token store.
//
// WHY NOT localStorage or sessionStorage?
//   Both Web Storage APIs are accessible to any JavaScript on the page.
//   An XSS vulnerability (injected script, compromised npm package) can
//   silently steal a token from localStorage within milliseconds.
//
//   Storing the access token in a closure-private module variable makes it
//   inaccessible to injected scripts.  The worst an XSS payload can do is
//   call the public API functions — the same as any legitimate app code —
//   which are rate-limited by the backend.
//
// Refresh token:
//   Stored in an httpOnly Secure SameSite=Strict cookie set by FastAPI.
//   JS cannot read it (neither app code nor injected scripts).
//   The browser automatically attaches it to requests to /api/v1/auth/*
//   when credentials: 'include' (withCredentials: true in axios).
//
// Tab / reload behavior:
//   The access token lives only for the lifetime of the JS module (page session).
//   On page reload, the app calls POST /api/v1/auth/refresh using the httpOnly
//   cookie — if the cookie is still valid, the user is silently re-authenticated.
// ─────────────────────────────────────────────────────────────────────────────

// Private variable — not exported; closure prevents external access
let _accessToken: string | null = null;
let _expiresAt: number | null   = null;    // Unix timestamp (ms)
let _refreshTimer: ReturnType<typeof setTimeout> | null = null;

/** Store a new access token with its lifetime. */
export function setToken(token: string, expiresInSeconds: number): void {
  _accessToken = token;
  _expiresAt = Date.now() + expiresInSeconds * 1000;
}

/** Return current access token, or null if not set / expired. */
export function getToken(): string | null {
  if (!_accessToken || !_expiresAt) return null;
  // Return null 30 s before actual expiry to give refresh a head start
  if (Date.now() > _expiresAt - 30_000) {
    clearToken();
    return null;
  }
  return _accessToken;
}

/** Clear the in-memory token (on logout or auth failure). */
export function clearToken(): void {
  _accessToken = null;
  _expiresAt = null;
  if (_refreshTimer !== null) {
    clearTimeout(_refreshTimer);
    _refreshTimer = null;
  }
}

/** True if a non-expired token is currently stored. */
export function isAuthenticated(): boolean {
  return getToken() !== null;
}

/**
 * Schedule a proactive token refresh before the access token expires.
 * `onRefresh` should call the refresh endpoint and call setToken() on success.
 * If refresh fails, it should call clearToken() to force re-login.
 */
export function scheduleRefresh(
  expiresInSeconds: number,
  onRefresh: () => Promise<void>,
): void {
  if (_refreshTimer !== null) clearTimeout(_refreshTimer);
  // Refresh 60 s before expiry (safe buffer for network latency)
  const msUntilRefresh = Math.max(0, (expiresInSeconds - 60) * 1000);
  _refreshTimer = setTimeout(async () => {
    try {
      await onRefresh();
    } catch {
      clearToken();
    }
  }, msUntilRefresh);
}
