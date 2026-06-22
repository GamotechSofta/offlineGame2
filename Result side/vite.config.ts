import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devProxyTarget =
    env.VITE_DEV_PROXY_TARGET?.replace(/\/$/, '') || 'https://api.singlepana.in'

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
