// Tous les textes de l'interface. L'arabe et l'anglais suivront la même forme.
export const fr = {
  appName: 'Rawi Audio',
  tagline: 'Histoires du Coran et des Prophètes, pour toute la famille',
  catalogTitle: 'Les épisodes',
  loading: 'Chargement…',
  emptyCatalog: 'Aucun épisode pour l’instant. Le premier arrive bientôt, inchâAllâh.',
  loadError: 'Impossible de charger les épisodes. Vérifiez la connexion, puis réessayez.',
  episodeError: 'Impossible de charger cet épisode. Vérifiez la connexion, puis réessayez.',
  retry: 'Réessayer',
  notFound: 'Cet épisode n’existe pas, ou n’est pas encore publié.',
  pageNotFound: 'Cette page n’existe pas.',
  backToCatalog: 'Tous les épisodes',
  episodeNumber: (n: number) => `Épisode ${n}`,
  series: (title: string) => `Série : ${title}`,
  sources: 'Sources',
  sourcesIntro: 'Les passages sur lesquels repose cet épisode, à lire sur Shamela.',
} as const
