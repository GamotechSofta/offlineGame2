import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devProxyTarget =
    env.VITE_DEV_PROXY_TARGET?.replace(/\/$/, '') || 'http://localhost:3010'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api/v1': {
          target: devProxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
