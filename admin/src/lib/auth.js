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
