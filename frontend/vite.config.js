import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devProxyTarget =
    env.VITE_DEV_PROXY_TARGET?.replace(/\/$/, '') || 'https://api.singlepana.in'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      // Dev: set VITE_API_BASE_URL=/api/v1 so requests stay same-origin; proxy forwards to production API (avoids CORS).
      proxy: {
        '/api/v1': {
          target: devProxyTarget,
          changeOrigin: true,
          secure: true,
        },
      },
    },
  }
})
