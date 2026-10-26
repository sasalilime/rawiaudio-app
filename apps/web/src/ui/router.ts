// Routeur minimal : deux pages ne justifient pas une bibliothèque.

export type Route = { name: 'catalog' } | { name: 'episode'; id: string } | { name: 'not-found' }

const EPISODE = /^\/episodes\/([a-z]{2}-\d{3})\/?$/

export function parseRoute(pathname: string): Route {
  if (pathname === '/' || pathname === '') return { name: 'catalog' }
  const match = EPISODE.exec(pathname)
  if (match?.[1]) return { name: 'episode', id: match[1] }
  return { name: 'not-found' }
}

export function episodePath(id: string): string {
  return `/episodes/${id}`
}
