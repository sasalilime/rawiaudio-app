/** Enregistre public/sw.js : l'appli s'ouvre sans réseau et lit les épisodes téléchargés. */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
    console.warn('service worker refusé : pas de hors ligne', error)
  })
}

/**
 * En dev, Vite et l'appli construite partagent l'adresse localhost:5180 : un service worker laissé
 * par un essai de l'appli construite servirait d'anciens fichiers. On le retire.
 */
export function unregisterServiceWorkers(): void {
  if (!('serviceWorker' in navigator)) return
  void navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .catch(() => undefined) // rien à retirer
}
