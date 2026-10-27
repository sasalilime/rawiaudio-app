// Point d'assemblage : le seul fichier qui connaît à la fois infra, core et ui (comme main.tsx de la PWA).
// localStorage persistant sur SQLite, installé en global : les stockages partagés tournent sans changement.
import 'expo-sqlite/localStorage/install'
import { nextPart } from '@rawiaudio/shared/core/domain/catalog.ts'
import { createAccountSession } from '@rawiaudio/shared/core/useCases/accountSession.ts'
import { createDownloadManager } from '@rawiaudio/shared/core/useCases/downloadManager.ts'
import { createGetEpisode } from '@rawiaudio/shared/core/useCases/getEpisode.ts'
import { createListCatalog } from '@rawiaudio/shared/core/useCases/listCatalog.ts'
import { createListeningHistory } from '@rawiaudio/shared/core/useCases/listeningHistory.ts'
import { createPickRandomEpisode } from '@rawiaudio/shared/core/useCases/pickRandomEpisode.ts'
import { createPlaybackSession } from '@rawiaudio/shared/core/useCases/playbackSession.ts'
import { createApi } from '@rawiaudio/shared/http/apiClient.ts'
import { createHttpAuthGateway } from '@rawiaudio/shared/http/authGateway.ts'
import { createHttpEpisodeRepository } from '@rawiaudio/shared/http/episodeRepository.ts'
import { createLocalCatalogCache } from '@rawiaudio/shared/storage/localCatalogCache.ts'
import { createLocalHistoryStore } from '@rawiaudio/shared/storage/localHistoryStore.ts'
import { createLocalPositionStore } from '@rawiaudio/shared/storage/localPositionStore.ts'
import { fr } from '@rawiaudio/shared/ui/i18n/fr.ts'
import type { UseCases } from '@rawiaudio/shared/ui/useCases.tsx'
import { createExpoAudioPlayer } from './infra/audio/expoAudioPlayer.ts'
import { createFileAudioStore } from './infra/offline/fileAudioStore.ts'
import { createSecureTokenStore } from './infra/session/secureTokenStore.ts'

// Sur un téléphone en dev : EXPO_PUBLIC_API_URL=http://<adresse du poste>:8080, sur le même Wi-Fi (README).
// Le jeton de session, lu à chaque appel, part dans Authorization : l'app n'a pas de cookies (ADR-0012).
const tokens = createSecureTokenStore()
const api = createApi(process.env.EXPO_PUBLIC_API_URL ?? 'https://api.rawiaudio.com', fetch, { token: tokens.get })
const episodes = createHttpEpisodeRepository(api)
const account = createAccountSession(createHttpAuthGateway(api, 'app', tokens))
const catalogCache = createLocalCatalogCache(localStorage)
const downloads = createDownloadManager(episodes, createFileAudioStore())
const history = createListeningHistory(createLocalHistoryStore(localStorage))

export const useCases: UseCases = {
  listCatalog: createListCatalog(episodes, catalogCache),
  getEpisode: createGetEpisode(episodes, catalogCache),
  playback: createPlaybackSession({
    episodes,
    player: createExpoAudioPlayer(),
    positions: createLocalPositionStore(localStorage),
    now: () => new Date(),
    // L'illustration de l'épisode sur l'écran verrouillé (ADR-0009), sa copie locale s'il est téléchargé :
    // iOS et Android lisent aussi une adresse file://. Sans illustration, l'icône de l'appli.
    // ponytail: cette icône vient de la PWA, absente tant qu'elle n'est pas en ligne.
    describe: (episode) => ({
      title: episode.title,
      artist: fr.appName,
      artworkUrl: episode.imageUrl ? downloads.imageSource(episode.imageUrl) : 'https://app.rawiaudio.com/icons/icon-512.png',
    }),
    localSource: downloads.localSource,
    // La suite d'une série d'après le dernier catalogue connu, disponible même hors ligne.
    // ponytail: français seulement, comme l'interface ; la langue de l'épisode quand l'arabe arrivera.
    nextPart: (episode) => nextPart(catalogCache.getList('fr') ?? [], episode),
    onHeard: history.markHeard,
  }),
  downloads,
  history,
  pickRandom: createPickRandomEpisode(Math.random),
  account,
}

// Les épisodes déjà téléchargés ; un échec (dossier illisible) laisse simplement la liste vide.
downloads.load().catch((error: unknown) => console.warn('téléchargements illisibles', error))

// La session de l'appareil. load ne lève jamais : hors ligne, l'état reste « unknown » et l'écran du compte réessaie.
void account.load()
