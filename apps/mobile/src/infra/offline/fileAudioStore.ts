import { Directory, File, Paths } from 'expo-file-system'
import type { OfflineAudioStore } from '@rawiaudio/shared/core/ports/offlineAudioStore.ts'

/**
 * Dans le cache de l'appli, et non dans Documents : Apple refuse qu'un contenu re-téléchargeable parte
 * dans la sauvegarde iCloud, et expo-file-system ne sait pas l'en exclure.
 * Le système peut vider ce dossier quand le téléphone est presque plein, comme Safari pour la PWA.
 */
const AUDIO_DIR = new Directory(Paths.cache, 'audio')
const IMAGES_DIR = new Directory(Paths.cache, 'images')
const EXTENSION = '.mp3'

/** Un fichier par épisode, nommé par son identifiant : jamais par l'URL signée, qui change (CLAUDE.md). */
const fileFor = (episodeId: string, extension = EXTENSION) => new File(AUDIO_DIR, encodeURIComponent(episodeId) + extension)

/** Une illustration par adresse : celle-ci ne change jamais (ADR-0009), elle sert de nom de fichier. */
const imageFor = (url: string) => new File(IMAGES_DIR, encodeURIComponent(url))

/** Télécharge sous un nom provisoire, puis renomme : un fichier partiel (Android) ne porte jamais le nom final. */
async function download(url: string, target: File, onProgress?: (fraction: number) => void) {
  const partial = new File(target.parentDirectory, target.name + '.part')
  await File.downloadFileAsync(url, partial, {
    idempotent: true,
    onProgress: onProgress && (({ bytesWritten, totalBytes }) => totalBytes > 0 && onProgress(bytesWritten / totalBytes)),
  })
  await partial.move(target, { overwrite: true })
}

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
      await download(url, fileFor(episodeId), onProgress)
    },
    async remove(episodeId) {
      const file = fileFor(episodeId)
      if (file.exists) file.delete()
    },
    async saveImage(url) {
      if (imageFor(url).exists) return // adresse immuable : déjà gardée
      IMAGES_DIR.create({ intermediates: true, idempotent: true })
      await download(url, imageFor(url))
    },
    // ponytail: l'illustration reste gardée quand on supprime l'épisode (40 Ko environ), comme dans la PWA.
    localImageUrl(url) {
      const file = imageFor(url)
      return file.exists ? file.uri : null
    },
    localUrl: (episodeId) => fileFor(episodeId).uri,
    async persist() {
      return false // le cache peut être vidé par le système : voir AUDIO_DIR
    },
  }
}
