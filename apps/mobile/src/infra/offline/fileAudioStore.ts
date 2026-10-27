import { Directory, File, Paths } from 'expo-file-system'
import type { OfflineAudioStore } from '@rawiaudio/shared/core/ports/offlineAudioStore.ts'

/**
 * Dans le cache de l'appli, et non dans Documents : Apple refuse qu'un contenu re-téléchargeable parte
 * dans la sauvegarde iCloud, et expo-file-system ne sait pas l'en exclure.
 * Le système peut vider ce dossier quand le téléphone est presque plein, comme Safari pour la PWA.
 */
const AUDIO_DIR = new Directory(Paths.cache, 'audio')
const EXTENSION = '.mp3'

/** Un fichier par épisode, nommé par son identifiant : jamais par l'URL signée, qui change (CLAUDE.md). */
const fileFor = (episodeId: string, extension = EXTENSION) => new File(AUDIO_DIR, encodeURIComponent(episodeId) + extension)

/** Les épisodes téléchargés, en fichiers sur le téléphone, lus directement par le lecteur. */
export function createFileAudioStore(): OfflineAudioStore {
  return {
    async list() {
      if (!AUDIO_DIR.exists) return []
      return AUDIO_DIR.list()
        .filter((entry) => entry instanceof File && entry.name.endsWith(EXTENSION))
        .map((file) => decodeURIComponent(file.name.slice(0, -EXTENSION.length)))
    },
    async save(episodeId, url, onProgress) {
      AUDIO_DIR.create({ intermediates: true, idempotent: true })
      // Android écrit au fil de l'eau et peut laisser un fichier partiel en cas d'échec : il ne prend
      // son nom définitif, celui que list() reconnaît, qu'une fois complet.
      const partial = fileFor(episodeId, '.part')
      await File.downloadFileAsync(url, partial, {
        idempotent: true,
        onProgress: ({ bytesWritten, totalBytes }) => {
          if (totalBytes > 0) onProgress(bytesWritten / totalBytes)
        },
      })
      await partial.move(fileFor(episodeId), { overwrite: true })
    },
    async remove(episodeId) {
      const file = fileFor(episodeId)
      if (file.exists) file.delete()
    },
    localUrl: (episodeId) => fileFor(episodeId).uri,
    async persist() {
      return false // le cache peut être vidé par le système : voir AUDIO_DIR
    },
  }
}
