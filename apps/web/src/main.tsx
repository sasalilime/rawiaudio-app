// Point d'assemblage : le seul fichier qui connaît à la fois infra, core et ui.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { nextPart } from '@rawiaudio/shared/core/domain/catalog.ts'
import { createDownloadManager } from '@rawiaudio/shared/core/useCases/downloadManager.ts'
import { createGetEpisode } from '@rawiaudio/shared/core/useCases/getEpisode.ts'
import { createListCatalog } from '@rawiaudio/shared/core/useCases/listCatalog.ts'
import { createListeningHistory } from '@rawiaudio/shared/core/useCases/listeningHistory.ts'
import { createPickRandomEpisode } from '@rawiaudio/shared/core/useCases/pickRandomEpisode.ts'
import { createPlaybackSession } from '@rawiaudio/shared/core/useCases/playbackSession.ts'
import { createHtmlAudioPlayer } from './infra/audio/htmlAudioPlayer.ts'
import { createApi } from '@rawiaudio/shared/http/apiClient.ts'
import { createHttpEpisodeRepository } from '@rawiaudio/shared/http/episodeRepository.ts'
import { createCacheAudioStore } from './infra/offline/cacheAudioStore.ts'
import { registerServiceWorker, unregisterServiceWorkers } from './infra/offline/registerServiceWorker.ts'
import { createLocalCatalogCache } from '@rawiaudio/shared/storage/localCatalogCache.ts'
import { createLocalHistoryStore } from '@rawiaudio/shared/storage/localHistoryStore.ts'
import { createLocalPositionStore } from '@rawiaudio/shared/storage/localPositionStore.ts'
import { App } from './ui/App.tsx'
import { fr } from '@rawiaudio/shared/ui/i18n/fr.ts'
import { UseCasesProvider, type UseCases } from '@rawiaudio/shared/ui/useCases.tsx'
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
    // L'illustration de l'épisode sur l'écran verrouillé (ADR-0009), l'icône de l'appli sinon.
    describe: (episode) => ({ title: episode.title, artist: fr.appName, artworkUrl: episode.imageUrl ?? '/icons/icon-512.png' }),
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
