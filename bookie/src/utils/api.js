const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';
const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173';

export const getBookieAuthHeaders = () => {
    const bookie = JSON.parse(localStorage.getItem('bookie') || '{}');
    const token = bookie?.token || '';
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
};

/** Clear bookie session and redirect to login. Use on 401 or suspend. */
export const clearBookieSession = () => {
    localStorage.removeItem('bookie');
    window.location.href = '/';
};

/**
 * Fetch with bookie auth headers. On 401, clears session and redirects to login.
 */
export async function fetchWithAuth(url, options = {}) {
    const headers = { ...getBookieAuthHeaders(), ...(options.headers || {}) };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
        clearBookieSession();
        return res;
    }
    return res;
}

export const getReferralUrl = (bookieId) => {
    return `${FRONTEND_URL}/login?ref=${bookieId}`;
};

/**
 * Display name for a market based on current language.
 * Uses Hindi name when language is 'hi' and market has name_hi/marketNameHi; otherwise English name.
 * Names are stored per language (not auto-translated).
 */
export const getMarketDisplayName = (market, language) => {
    if (!market) return '';
    const hi = market.marketNameHi ?? market.name_hi ?? '';
    const en = market.marketName ?? market.name ?? '';
    if (language === 'hi' && hi) return hi;
    return en || hi;
};

export { API_BASE_URL, FRONTEND_URL };
