// Service worker du prototype : coquille hors ligne, et lecture de l'épisode téléchargé.

const SHELL_CACHE = 'shell-v1';
const AUDIO_CACHE = 'audio-v1';
const SHELL = ['/', '/app.js', '/manifest.webmanifest', '/icon-180.png', '/icon-512.png', '/media/ep1.jpg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/offline/')) {
    event.respondWith(fromAudioCache(url.pathname, event.request.headers.get('range')));
    return;
  }
  if (url.pathname.endsWith('.mp3')) return; // streaming : réseau direct, sans passer par ici

  // Coquille : réseau d'abord pour recevoir les nouvelles versions, cache si hors ligne.
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
      .then((response) => response ?? Response.error()),
  );
});

// Safari lit l'audio par plages (il commence par bytes=0-1) : sans réponse 206, il refuse de lire.
// ponytail: tout le fichier est relu à chaque plage ; tient pour 6 Mo, lecture par tranches si les épisodes grossissent.
async function fromAudioCache(key, range) {
  const cached = await caches.match(key, { cacheName: AUDIO_CACHE });
  if (!cached) return new Response('Épisode non téléchargé', { status: 404 });

  const blob = await cached.blob();
  const size = blob.size;
  const headers = { 'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes' };
  if (!range) return new Response(blob, { headers: { ...headers, 'Content-Length': String(size) } });

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  let start = NaN;
  let end = size - 1;
  if (match && match[1] !== '') {
    start = Number(match[1]);
    if (match[2] !== '') end = Math.min(Number(match[2]), size - 1);
  } else if (match && match[2] !== '') {
    start = Math.max(size - Number(match[2]), 0); // bytes=-N : les N derniers octets
  }
  if (!(start <= end)) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }

  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: {
      ...headers,
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
    },
  });
}
