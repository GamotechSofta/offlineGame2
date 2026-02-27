// API base URL – set in mobile/.env as EXPO_PUBLIC_API_BASE_URL. All API calls use this; do not hardcode the backend URL elsewhere.
export const API_BASE_URL =
  (typeof global !== 'undefined' && global.__API_BASE_URL__) ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  'https://api.singlepana.in/api/v1';

import { getUserCache } from './storage';

let _onLogout = () => {};

export function setOnLogout(fn) {
  _onLogout = fn;
}

export function getAuthHeaders() {
  const user = getUserCache();
  const token = user?.token;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export function clearUserSession() {
  _onLogout();
}

export async function fetchWithAuth(url, options = {}) {
  const headers = { ...getAuthHeaders(), ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    clearUserSession();
    return res;
  }
  return res;
}
