// Routeur minimal : cinq pages ne justifient pas une bibliothèque.

export type Route =
  | { name: 'catalog' }
  | { name: 'episode'; id: string }
  | { name: 'series'; id: string }
  | { name: 'signIn' }
  | { name: 'account' }
  | { name: 'not-found' }

const EPISODE = /^\/episodes\/([a-z]{2}-\d{3})\/?$/
const SERIES = /^\/series\/([a-z]{2}-[a-z0-9]+(?:-[a-z0-9]+)*)\/?$/
const SIGN_IN = /^\/connexion\/?$/
const ACCOUNT = /^\/compte\/?$/
// Jeton du lien de l'e-mail (ADR-0012) : 32 octets en base64url sans remplissage, soit 43 caractères.
const LINK_TOKEN = /^#jeton=([A-Za-z0-9_-]{43})$/

export function parseRoute(pathname: string): Route {
  if (pathname === '/' || pathname === '') return { name: 'catalog' }
  const episode = EPISODE.exec(pathname)
  if (episode?.[1]) return { name: 'episode', id: episode[1] }
  const series = SERIES.exec(pathname)
  if (series?.[1]) return { name: 'series', id: series[1] }
  if (SIGN_IN.test(pathname)) return { name: 'signIn' }
  if (ACCOUNT.test(pathname)) return { name: 'account' }
  return { name: 'not-found' }
}

export function episodePath(id: string): string {
  return `/episodes/${id}`
}

export function seriesPath(id: string): string {
  return `/series/${id}`
}

export function signInPath(): string {
  return '/connexion'
}

export function accountPath(): string {
  return '/compte'
}

/** Le jeton d'un lien de connexion (location.hash), ou null si le fragment n'en est pas un. */
export function linkToken(hash: string): string | null {
  return LINK_TOKEN.exec(hash)?.[1] ?? null
}
