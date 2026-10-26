import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Pas le port par défaut de Vite (5173) : Mastour l'occupe déjà. Le CORS de R2 autorise ce port précis.
    port: 5180,
    strictPort: true,
    proxy: {
      // En dev, la PWA appelle /api/… sur sa propre origine : l'API n'a pas besoin de CORS.
      '/api': { target: 'http://localhost:8080', rewrite: (path) => path.replace(/^\/api/, '') },
    },
  },
})
