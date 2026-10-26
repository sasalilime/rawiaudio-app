// Prototype jetable : la lecture audio d'une PWA tient-elle sur iPhone ? Protocole dans README.md.

const VERSION = 'spike-1'; // à changer à chaque déploiement, pour savoir quelle version tourne sur l'iPhone

const EPISODE = {
  id: 'fr-001-les-gens-de-la-caverne',
  title: 'Les Gens de la Caverne',
  url: '/media/ep1.mp3',
  artwork: '/media/ep1.jpg',
};
const AUDIO_CACHE = 'audio-v1';
const OFFLINE_URL = `/offline/${EPISODE.id}`; // servie par sw.js depuis le cache
const LOG_KEY = 'rawi-spike-log';
const POSITION_KEY = `rawi-spike-position-${EPISODE.id}`;

const $ = (id) => document.getElementById(id);
const audio = $('player');
let downloaded = false;

// Simule une URL signée R2 : l'URL change à chaque appel, la clé de cache (l'identifiant) jamais.
const signedUrl = () => `${EPISODE.url}?sig=${crypto.randomUUID()}`;

const formatTime = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

// --- Journal, gardé dans localStorage pour le relire après un verrouillage ou une fermeture ---

const readLog = () => JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]');

function log(message) {
  const line = `${new Date().toLocaleTimeString('fr-FR')} ${message}`;
  localStorage.setItem(LOG_KEY, JSON.stringify([...readLog(), line].slice(-300)));
  renderLog();
}

function renderLog() {
  $('log').replaceChildren(
    ...readLog().reverse().map((line) => Object.assign(document.createElement('li'), { textContent: line })),
  );
}

// --- Lecture ---

// play() doit partir directement du geste : pas d'await avant, sinon iOS peut refuser la lecture.
function playFrom(src, label) {
  audio.src = src;
  audio.play().then(
    () => log(`lecture ${label}`),
    (err) => log(`lecture refusée (${label}) : ${err.name}`),
  );
}

$('stream').addEventListener('click', () => playFrom(signedUrl(), 'en streaming'));
$('offline').addEventListener('click', () => {
  if (!downloaded) return setStatus("L'épisode n'est pas téléchargé.");
  playFrom(OFFLINE_URL, 'hors ligne');
});

// --- Téléchargement : stocké sous l'identifiant de l'épisode, pas sous l'URL ---

$('download').addEventListener('click', async () => {
  setStatus('Téléchargement…');
  log('téléchargement démarré');
  try {
    const response = await fetch(signedUrl());
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const cache = await caches.open(AUDIO_CACHE);
    await cache.put(OFFLINE_URL, response);
    log('téléchargement terminé');
    const persisted = await navigator.storage?.persist?.();
    log(`stockage persistant accordé : ${persisted}`);
  } catch (err) {
    log(`échec du téléchargement : ${err.message}`);
  }
  await refreshStatus();
});

$('remove').addEventListener('click', async () => {
  await caches.delete(AUDIO_CACHE);
  log('téléchargement supprimé');
  await refreshStatus();
});

// --- Media Session : enregistrée dans « playing », pas avant (iOS ignore sinon les actions) ---

function seekBy(offset) {
  audio.currentTime = Math.min(Math.max(audio.currentTime + offset, 0), audio.duration || 0);
}

function updatePositionState() {
  if (!Number.isFinite(audio.duration)) return;
  try {
    navigator.mediaSession.setPositionState({
      duration: audio.duration,
      playbackRate: audio.playbackRate,
      position: audio.currentTime,
    });
  } catch (err) {
    log(`setPositionState refusé : ${err.message}`);
  }
}

audio.addEventListener('playing', () => {
  if (!('mediaSession' in navigator)) return log('Media Session absente');
  navigator.mediaSession.metadata = new MediaMetadata({
    title: EPISODE.title,
    artist: 'Rawi Audio',
    artwork: [
      { src: EPISODE.artwork, sizes: '1280x720', type: 'image/jpeg' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  });
  const handlers = {
    play: () => audio.play(),
    pause: () => audio.pause(),
    seekbackward: (details) => seekBy(-(details.seekOffset ?? 15)),
    seekforward: (details) => seekBy(details.seekOffset ?? 15),
    seekto: (details) => { audio.currentTime = details.seekTime; },
  };
  for (const [action, handler] of Object.entries(handlers)) {
    try {
      navigator.mediaSession.setActionHandler(action, (details) => {
        log(`écran verrouillé : ${action}`);
        handler(details);
      });
    } catch {
      log(`action ${action} non prise en charge`);
    }
  }
  updatePositionState();
});
audio.addEventListener('seeked', () => 'mediaSession' in navigator && updatePositionState());

// --- Reprise de la position ---

let lastSave = 0;
function savePosition() {
  lastSave = Date.now();
  if (audio.currentTime > 0) localStorage.setItem(POSITION_KEY, String(audio.currentTime));
}
audio.addEventListener('timeupdate', () => Date.now() - lastSave > 5000 && savePosition());
audio.addEventListener('pause', savePosition);
audio.addEventListener('loadedmetadata', () => {
  const saved = Number(localStorage.getItem(POSITION_KEY));
  if (saved > 5 && saved < audio.duration - 5) {
    audio.currentTime = saved;
    log(`reprise à ${formatTime(saved)}`);
  }
});

// --- Événements à surveiller ---

for (const type of ['play', 'playing', 'pause', 'waiting', 'stalled', 'ended']) {
  audio.addEventListener(type, () => log(`audio ${type} à ${formatTime(audio.currentTime)}`));
}
audio.addEventListener('error', () => log(`audio error code ${audio.error?.code} ${audio.error?.message ?? ''}`));
document.addEventListener('visibilitychange', () => log(`page ${document.visibilityState}`));
addEventListener('pagehide', (event) => {
  savePosition();
  log(`pagehide (persisted=${event.persisted})`);
});
addEventListener('pageshow', (event) => log(`pageshow (persisted=${event.persisted})`));
addEventListener('online', () => log('réseau : en ligne'));
addEventListener('offline', () => log('réseau : hors ligne'));

// --- État affiché ---

function setStatus(text) {
  $('status').textContent = text;
}

async function refreshStatus() {
  downloaded = Boolean(await caches.match(OFFLINE_URL, { cacheName: AUDIO_CACHE }));
  const parts = [downloaded ? 'Épisode téléchargé.' : 'Épisode non téléchargé.'];
  const estimate = await navigator.storage?.estimate?.();
  if (estimate) {
    parts.push(`Stockage : ${(estimate.usage / 1e6).toFixed(1)} Mo utilisés sur ${(estimate.quota / 1e6).toFixed(0)} Mo.`);
  }
  parts.push(`Persistant : ${await navigator.storage?.persisted?.()}.`);
  setStatus(parts.join(' '));
}

$('copy').addEventListener('click', async () => {
  await navigator.clipboard.writeText(readLog().join('\n'));
  setStatus('Journal copié.');
});
$('clear').addEventListener('click', () => {
  localStorage.removeItem(LOG_KEY);
  renderLog();
});

// --- Démarrage ---

const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
$('mode').textContent = `${VERSION} · ${standalone ? 'appli installée (écran d’accueil)' : 'dans le navigateur'}`;
renderLog();
log(`ouverture ${VERSION}, ${standalone ? 'installée' : 'navigateur'}, ${navigator.onLine ? 'en ligne' : 'hors ligne'}`);
await refreshStatus();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(
    () => log('service worker enregistré'),
    (err) => log(`service worker refusé : ${err.message}`),
  );
} else {
  log('service worker absent');
}
