import type { OfflineAudioStore } from '@rawiaudio/shared/core/ports/offlineAudioStore.ts'

/** Mêmes noms que dans public/sw.js, qui sert ces fichiers au lecteur et aux images. */
const AUDIO_CACHE = 'rawi-audio-v1'
const IMAGES_CACHE = 'rawi-images-v1'
const PREFIX = '/offline/'

/** Adresse locale d'un épisode : jamais l'URL signée, qui change à chaque appel (CLAUDE.md). */
const localUrl = (episodeId: string) => PREFIX + encodeURIComponent(episodeId)

/** Les épisodes téléchargés, dans la Cache API, servis au lecteur par le service worker (réponses 206). */
export function createCacheAudioStore(): OfflineAudioStore {
  return {
    async list() {
      const cache = await caches.open(AUDIO_CACHE)
      return (await cache.keys())
        .map((request) => new URL(request.url).pathname)
        .filter((path) => path.startsWith(PREFIX))
        .map((path) => decodeURIComponent(path.slice(PREFIX.length)))
    },
    async save(episodeId, url, onProgress) {
      const response = await fetch(url) // R2 : le CORS du bucket doit autoriser l'origine de l'appli
      if (!response.ok || !response.body) throw new Error(`téléchargement refusé : ${response.status}`)
      const total = Number(response.headers.get('Content-Length')) || 0

      // Lecture morceau par morceau pour suivre la progression.
      // ponytail: le fichier entier passe en mémoire (6 Mo par épisode) ; écrire au fil de l'eau si les épisodes grossissent.
      const reader = response.body.getReader()
      const chunks: Uint8Array<ArrayBuffer>[] = []
      let received = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        received += value.byteLength
        if (total > 0) onProgress(received / total)
      }

      const blob = new Blob(chunks, { type: 'audio/mpeg' })
      const cache = await caches.open(AUDIO_CACHE)
      await cache.put(
        localUrl(episodeId),
        new Response(blob, { headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(blob.size) } }),
      )
    },
    async remove(episodeId) {
      const cache = await caches.open(AUDIO_CACHE)
      await cache.delete(localUrl(episodeId))
      // ponytail: l'illustration reste gardée (40 Ko environ) ; la supprimer aussi si l'espace venait à compter.
    },
    async saveImage(url) {
      const cache = await caches.open(IMAGES_CACHE)
      if (await cache.match(url)) return // adresse immuable (ADR-0009) : déjà gardée, rien à refaire
      // Requête CORS (le bucket autorise l'origine de l'appli) : une réponse opaque compterait pour des Mo
      // dans le quota du navigateur. reload : sans le cache HTTP, dont la copie chargée par <img> n'a pas
      // les en-têtes CORS.
      const response = await fetch(url, { cache: 'reload' })
      if (!response.ok) throw new Error(`illustration refusée : ${response.status}`)
      await cache.put(url, response)
    },
    localUrl,
    localImageUrl: () => null, // le service worker sert la copie sous l'adresse en ligne
    async persist() {
      return navigator.storage?.persist ? navigator.storage.persist() : false
    },
  }
}
