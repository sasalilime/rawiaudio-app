// Service worker de Rawi, écrit à la main (CLAUDE.md : pas de vite-plugin-pwa).
// 1. La coquille de l'appli en cache : elle s'ouvre sans réseau.
// 2. Les épisodes téléchargés servis au lecteur, en réponses 206 (Safari lit l'audio par plages d'octets).
// 3. Les illustrations des épisodes téléchargés, servies depuis leur copie (ADR-0009).

const SHELL_CACHE = 'rawi-shell-v1'
const AUDIO_CACHE = 'rawi-audio-v1' // mêmes noms dans src/infra/offline/cacheAudioStore.ts
const IMAGES_CACHE = 'rawi-images-v1'

const STATIC_FILES = [
  '/',
  '/manifest.webmanifest',
  '/img/symbole.svg',
  '/icons/icon-180.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/fonts/lalezar-latin.woff2',
  '/fonts/lalezar-arabic.woff2',
  '/fonts/literata.woff2',
]

// Les fichiers JS et CSS de Vite changent de nom à chaque build : on les lit dans la page.
const assetsIn = (html) => [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1])

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE)
      const page = await fetch('/')
      await cache.addAll([...STATIC_FILES.filter((path) => path !== '/'), ...assetsIn(await page.clone().text())])
      await cache.put('/', page)
    })(),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith('rawi-shell-') && name !== SHELL_CACHE) await caches.delete(name)
      }
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) {
    // Image d'un autre domaine (illustration) : sa copie si l'épisode est téléchargé, sinon le réseau.
    // API, R2 et le reste : le réseau, directement.
    if (request.destination === 'image') event.respondWith(fromImagesCache(request))
    return
  }
  if (url.pathname.startsWith('/offline/')) {
    event.respondWith(fromAudioCache(url.pathname, request.headers.get('range')))
    return
  }
  // Relais de l'API et fichiers du serveur de dev de Vite : jamais en cache.
  if (/^\/(api|src|node_modules|@)/.test(url.pathname)) return
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(event))
    return
  }
  event.respondWith(cacheFirst(request))
})

// Pages : le réseau d'abord, pour avoir la dernière version ; la coquille en cache sans réseau.
// Toutes les adresses de l'appli renvoient la même page.
async function networkFirst(event) {
  try {
    const response = await fetch(event.request)
    if (response.ok) event.waitUntil(refreshShell(response.clone()))
    return response
  } catch {
    return (await caches.match('/', { cacheName: SHELL_CACHE })) ?? Response.error()
  }
}

// Les fichiers d'abord, puis la page qui les cite : jamais une page en cache qui pointe vers des fichiers absents.
// ponytail: les anciens fichiers de Vite ne sont jamais supprimés (~250 Ko par version) ; vidés en changeant SHELL_CACHE.
async function refreshShell(response) {
  try {
    const cache = await caches.open(SHELL_CACHE)
    await cache.addAll(assetsIn(await response.clone().text()))
    await cache.put('/', response)
  } catch {
    // réseau coupé en cours de route : on garde l'ancienne coquille, cohérente
  }
}

// Fichiers statiques : leur nom ou leur contenu ne change pas, le cache suffit.
async function cacheFirst(request) {
  const cached = await caches.match(request, { cacheName: SHELL_CACHE })
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(SHELL_CACHE)
    await cache.put(request, response.clone())
  }
  return response
}

// Une illustration ne change jamais sous la même adresse : la copie gardée vaut la version en ligne.
async function fromImagesCache(request) {
  return (await caches.match(request.url, { cacheName: IMAGES_CACHE })) ?? fetch(request)
}

// Safari commence par demander les octets 0 et 1 : sans réponse 206, il refuse de lire.
// ponytail: le fichier entier est relu à chaque plage ; tient pour 6 Mo, lecture par tranches si les épisodes grossissent.
async function fromAudioCache(path, range) {
  const cached = await caches.match(path, { cacheName: AUDIO_CACHE })
  if (!cached) return new Response('Épisode non téléchargé', { status: 404 })

  const blob = await cached.blob()
  const size = blob.size
  const headers = { 'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes' }
  if (!range) return new Response(blob, { headers: { ...headers, 'Content-Length': String(size) } })

  const match = /^bytes=(\d*)-(\d*)$/.exec(range)
  let start = Number.NaN
  let end = size - 1
  if (match && match[1] !== '') {
    start = Number(match[1])
    if (match[2] !== '') end = Math.min(Number(match[2]), size - 1)
  } else if (match && match[2] !== '') {
    start = Math.max(size - Number(match[2]), 0) // bytes=-N : les N derniers octets
  }
  if (!(start <= end)) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
  }
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) },
  })
}
