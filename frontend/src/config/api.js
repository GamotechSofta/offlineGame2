import { clearCurrentUser, getCurrentUser } from '../session/userSession';

// API Configuration – set VITE_API_BASE_URL at build time (Render env, CI, or .env.production).
// Without it, dev uses localhost; production build must not embed localhost (breaks live sites).
// Local + prod API without CORS in dev: VITE_API_BASE_URL=/api/v1 + Vite proxy (vite.config.js).
const _api =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:3010/api/v1' : 'https://api.singlepana.in/api/v1');

export const API_BASE_URL = _api;

// Backend base URL for static assets (downloads, etc.) – derived from API or set via VITE_BACKEND_BASE_URL
const isRelativeApi = typeof _api === 'string' && _api.startsWith('/');
export const BACKEND_BASE_URL =
  import.meta.env.VITE_BACKEND_BASE_URL ||
  (isRelativeApi
    ? import.meta.env.VITE_DEV_PROXY_TARGET?.replace(/\/$/, '') || 'https://api.singlepana.in'
    : _api.replace(/\/api\/v1\/?$/, ''));

/** Android APK for "Download App" (navbar, menu, download page). Override with VITE_ANDROID_APK_URL. */
export const ANDROID_APK_URL =
  import.meta.env.VITE_ANDROID_APK_URL ||
  'https://shri-balaji-app.s3.ap-south-1.amazonaws.com/app-release.apk';

/**
 * Origin for Socket.IO (no /api/v1 path).
 * Override with VITE_SOCKET_URL (e.g. http://localhost:3010).
 * If VITE_API_BASE_URL is relative, uses current origin so Vite can proxy /socket.io.
 */
export function getQuizSocketUrl() {
  const raw = import.meta.env.VITE_SOCKET_URL;
  if (raw && String(raw).trim()) {
    return String(raw).replace(/\/$/, '');
  }
  if (isRelativeApi && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return String(BACKEND_BASE_URL || '').replace(/\/$/, '');
}

/**
 * Returns headers with Bearer token for authenticated player API calls.
 * Token is stored in localStorage user object after login.
 * For JSON body use: { 'Content-Type': 'application/json', ...getAuthHeaders() }
 * For FormData omit Content-Type (fetch sets multipart boundary).
 */
export function getAuthHeaders() {
  const token = getCurrentUser()?.token;
  if (!token || token === 'cookie-auth') return {};
  return { Authorization: `Bearer ${token}` };
}

/** Clear user session and redirect to login. Use on 401 or suspend. */
export function clearUserSession() {
  try {
    fetch(`${API_BASE_URL}/users/logout`, {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
    }).catch(() => {});
  } catch (_) {}
  clearCurrentUser();
  window.location.href = '/login';
}

/**
 * Fetch with auth headers. On 401, clears session and redirects to login.
 */
export async function fetchWithAuth(url, options = {}) {
  const headers = { ...getAuthHeaders(), ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers, credentials: 'include' });
  if (res.status === 401) {
    clearUserSession();
    return res;
  }
  return res;
}
