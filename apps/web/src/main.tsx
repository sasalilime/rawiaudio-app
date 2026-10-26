// Point d'assemblage : le seul fichier qui connaît à la fois infra, core et ui.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { nextPart } from './core/domain/catalog.ts'
import { createDownloadManager } from './core/useCases/downloadManager.ts'
import { createGetEpisode } from './core/useCases/getEpisode.ts'
import { createListCatalog } from './core/useCases/listCatalog.ts'
import { createListeningHistory } from './core/useCases/listeningHistory.ts'
import { createPickRandomEpisode } from './core/useCases/pickRandomEpisode.ts'
import { createPlaybackSession } from './core/useCases/playbackSession.ts'
import { createHtmlAudioPlayer } from './infra/audio/htmlAudioPlayer.ts'
import { createApi } from './infra/http/apiClient.ts'
import { createHttpEpisodeRepository } from './infra/http/episodeRepository.ts'
import { createCacheAudioStore } from './infra/offline/cacheAudioStore.ts'
import { registerServiceWorker, unregisterServiceWorkers } from './infra/offline/registerServiceWorker.ts'
import { createLocalCatalogCache } from './infra/storage/localCatalogCache.ts'
import { createLocalHistoryStore } from './infra/storage/localHistoryStore.ts'
import { createLocalPositionStore } from './infra/storage/localPositionStore.ts'
import { App } from './ui/App.tsx'
import { fr } from './ui/i18n/fr.ts'
import { UseCasesProvider, type UseCases } from './ui/useCases.tsx'
import './ui/styles.css'

// En dev, /api passe par le relais de Vite ; en production, VITE_API_URL vaut https://api.rawiaudio.com.
const episodes = createHttpEpisodeRepository(createApi(import.meta.env.VITE_API_URL ?? '/api'))
const catalogCache = createLocalCatalogCache(localStorage)
const downloads = createDownloadManager(episodes, createCacheAudioStore())
const history = createListeningHistory(createLocalHistoryStore(localStorage))

const useCases: UseCases = {
  listCatalog: createListCatalog(episodes, catalogCache),
  getEpisode: createGetEpisode(episodes, catalogCache),
  playback: createPlaybackSession({
    episodes,
    player: createHtmlAudioPlayer(document),
    positions: createLocalPositionStore(localStorage),
    now: () => new Date(),
    describe: (episode) => ({ title: episode.title, artist: fr.appName, artworkUrl: '/icons/icon-512.png' }),
    localSource: downloads.localSource,
    // La suite d'une série d'après le dernier catalogue connu, disponible même hors ligne.
    // ponytail: français seulement, comme l'interface ; la langue de l'épisode quand l'arabe arrivera.
    nextPart: (episode) => nextPart(catalogCache.getList('fr') ?? [], episode),
    onHeard: history.markHeard,
  }),
  downloads,
  history,
  pickRandom: createPickRandomEpisode(Math.random),
}

// Les épisodes déjà téléchargés ; un échec (Cache API indisponible) laisse simplement la liste vide.
downloads.load().catch((error: unknown) => console.warn('téléchargements illisibles', error))

if (import.meta.env.PROD) registerServiceWorker()
else unregisterServiceWorkers()

const root = document.getElementById('root')
if (!root) throw new Error('index.html : élément #root introuvable')

createRoot(root).render(
  <StrictMode>
    <UseCasesProvider value={useCases}>
      <App />
    </UseCasesProvider>
  </StrictMode>,
)
