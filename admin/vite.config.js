import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
})
