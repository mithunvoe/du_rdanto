import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Get backend URL from environment variable, default to localhost for dev
const backendUrl = process.env.VITE_BACKEND_URL || 'http://localhost:3000'
const wsBackendUrl = process.env.VITE_WS_BACKEND_URL || 'ws://localhost:3000'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Allow external connections for Docker
    port: 5174,
    proxy: {
      '/v1': {
        target: backendUrl,
        changeOrigin: true,
      },
      '/ws': {
        target: wsBackendUrl,
        ws: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5174,
  },
})