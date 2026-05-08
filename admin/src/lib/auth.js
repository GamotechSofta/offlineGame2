/**
 * Shared auth for Super Admin panel.
 * Uses JWT (Bearer) only; no password stored or sent.
 */
export function getAuthHeaders() {
    const token = localStorage.getItem('adminToken');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    return headers;
}

/**
 * Fetch with auth headers. On 401, clears session and redirects to login.
 * Use for admin API calls so expired/invalid token is handled in one place.
 */
export async function fetchWithAuth(url, options = {}) {
    const headers = { ...getAuthHeaders(), ...(options.headers || {}) };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
        clearAdminSession();
        window.location.href = '/';
        return res;
    }
    return res;
}

export function clearAdminSession() {
    localStorage.removeItem('admin');
    localStorage.removeItem('adminToken');
}

/**
 * Origin for Socket.IO (no /api path).
 * Override with VITE_SOCKET_URL if needed.
 */
export function getAdminSocketUrl() {
    const raw = import.meta.env.VITE_SOCKET_URL;
    if (raw && String(raw).trim()) {
        return String(raw).replace(/\/$/, '');
    }
    const apiBase = String(import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1');
    if (apiBase.startsWith('/')) {
        if (typeof window !== 'undefined') return window.location.origin;
        return '';
    }
    return apiBase.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
}
