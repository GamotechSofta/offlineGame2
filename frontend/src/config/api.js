// API Configuration – set VITE_API_BASE_URL in Render (or .env) for production
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

/**
 * Returns headers with Bearer token for authenticated player API calls.
 * Token is stored in localStorage user object after login.
 * For JSON body use: { 'Content-Type': 'application/json', ...getAuthHeaders() }
 * For FormData omit Content-Type (fetch sets multipart boundary).
 */
export function getAuthHeaders() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const token = user?.token;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
