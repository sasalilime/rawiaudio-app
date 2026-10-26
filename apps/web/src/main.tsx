// Point d'assemblage : le seul fichier qui connaît à la fois infra, core et ui.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createGetEpisode } from './core/useCases/getEpisode.ts'
import { createListCatalog } from './core/useCases/listCatalog.ts'
import { createApi } from './infra/http/apiClient.ts'
import { createHttpEpisodeRepository } from './infra/http/episodeRepository.ts'
import { App } from './ui/App.tsx'
import { UseCasesProvider, type UseCases } from './ui/useCases.tsx'
import './ui/styles.css'

// En dev, /api passe par le relais de Vite ; en production, VITE_API_URL vaut https://api.rawiaudio.com.
const episodes = createHttpEpisodeRepository(createApi(import.meta.env.VITE_API_URL ?? '/api'))

const useCases: UseCases = {
  listCatalog: createListCatalog(episodes),
  getEpisode: createGetEpisode(episodes),
}

const root = document.getElementById('root')
if (!root) throw new Error('index.html : élément #root introuvable')

createRoot(root).render(
  <StrictMode>
    <UseCasesProvider value={useCases}>
      <App />
    </UseCasesProvider>
  </StrictMode>,
)
