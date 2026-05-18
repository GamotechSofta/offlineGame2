const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';
const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173';

const AUTH_KEY = 'superBookie';

export const getSuperBookieAuthHeaders = () => {
    const session = JSON.parse(localStorage.getItem(AUTH_KEY) || '{}');
    const token = session?.token || '';
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
};

export const clearSuperBookieSession = () => {
    localStorage.removeItem(AUTH_KEY);
    window.location.href = '/';
};

export async function fetchWithAuth(url, options = {}) {
    const headers = { ...getSuperBookieAuthHeaders(), ...(options.headers || {}) };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
        clearSuperBookieSession();
        return res;
    }
    return res;
}

export const getReferralUrl = (superBookieId) => {
    return `${FRONTEND_URL}/login?ref=${superBookieId}`;
};

export const getMarketDisplayName = (market, language) => {
    if (!market) return '';
    const hi = market.marketNameHi ?? market.name_hi ?? '';
    const en = market.marketName ?? market.name ?? '';
    if (language === 'hi' && hi) return hi;
    return en || hi;
};

export const getBookieAuthHeaders = getSuperBookieAuthHeaders;
export const clearBookieSession = clearSuperBookieSession;

export function getPanelSocketUrl() {
    const raw = import.meta.env.VITE_SOCKET_URL;
    if (raw && String(raw).trim()) {
        return String(raw).replace(/\/$/, '');
    }
    const apiBase = String(API_BASE_URL || 'http://localhost:3010/api/v1');
    if (apiBase.startsWith('/')) {
        const proxyTarget = import.meta.env.VITE_DEV_PROXY_TARGET;
        if (proxyTarget && String(proxyTarget).trim()) {
            return String(proxyTarget).replace(/\/$/, '');
        }
        if (typeof window !== 'undefined') return window.location.origin;
        return '';
    }
    return apiBase.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
}

export { API_BASE_URL, FRONTEND_URL, AUTH_KEY };
