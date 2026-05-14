import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'
import { adminQueryClient } from './lib/queryClient'

const isStrictModeEnabled = import.meta.env.VITE_ENABLE_STRICT_MODE === '1'

createRoot(document.getElementById('root')).render(
  isStrictModeEnabled ? (
  <StrictMode>
    <QueryClientProvider client={adminQueryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>) : (
    <QueryClientProvider client={adminQueryClient}>
      <App />
    </QueryClientProvider>
  ),
)
