import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:9000',
        changeOrigin: true,
        // Falls dein Backend /api erwartet → Zeile so lassen
        // Falls dein Backend kein /api erwartet:
        // rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
