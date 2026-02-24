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

export function clearAdminSession() {
    localStorage.removeItem('admin');
    localStorage.removeItem('adminToken');
}
