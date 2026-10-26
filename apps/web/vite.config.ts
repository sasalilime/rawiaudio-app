import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En dev, la PWA appelle /api/… sur sa propre origine : l'API n'a pas besoin de CORS.
const proxy = { '/api': { target: 'http://localhost:8080', rewrite: (path: string) => path.replace(/^\/api/, '') } }

// Pas le port par défaut de Vite (5173) : Mastour l'occupe déjà. Le CORS de R2 autorise ce port précis.
// vite preview (l'appli construite, avec son service worker) sert à la même adresse.
const local = { port: 5180, strictPort: true, proxy }

export default defineConfig({
  plugins: [react()],
  server: local,
  preview: local,
})
