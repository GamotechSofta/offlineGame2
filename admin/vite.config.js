import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const devProxyTarget =
    env.VITE_DEV_PROXY_TARGET?.replace(/\/$/, '') || 'http://localhost:3010';

  return {
    plugins: [react(), tailwindcss()],
    server: {
      // When VITE_API_BASE_URL is /api/v1, proxy REST + Socket.IO to the API server (same as player app).
      proxy: {
        '/api/v1': {
          target: devProxyTarget,
          changeOrigin: true,
          secure: true,
        },
        '/socket.io': {
          target: devProxyTarget,
          changeOrigin: true,
          secure: true,
          ws: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('@tanstack/react-query')) return 'rq';
            if (id.includes('recharts')) return 'charts';
            if (id.includes('socket.io-client')) return 'socket';
            if (id.includes('react-icons')) return 'icons';
            return 'vendor';
          },
        },
      },
    },
  };
});
