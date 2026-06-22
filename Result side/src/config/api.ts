const apiBase =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? '/api/v1' : 'http://localhost:3010/api/v1')

export const API_BASE_URL = apiBase
