// Dev: VITE_API_BASE_URL=/api/v1 + Vite proxy. Vercel prod: same relative URL + vercel.json rewrite to API.
const envApi = import.meta.env.VITE_API_BASE_URL

export const API_BASE_URL =
  envApi ||
  (import.meta.env.DEV ? '/api/v1' : 'https://api.singlepana.in/api/v1')
