// Routeur minimal : trois pages ne justifient pas une bibliothèque.

export type Route =
  | { name: 'catalog' }
  | { name: 'episode'; id: string }
  | { name: 'series'; id: string }
  | { name: 'not-found' }

const EPISODE = /^\/episodes\/([a-z]{2}-\d{3})\/?$/
const SERIES = /^\/series\/([a-z]{2}-[a-z0-9]+(?:-[a-z0-9]+)*)\/?$/

export function parseRoute(pathname: string): Route {
  if (pathname === '/' || pathname === '') return { name: 'catalog' }
  const episode = EPISODE.exec(pathname)
  if (episode?.[1]) return { name: 'episode', id: episode[1] }
  const series = SERIES.exec(pathname)
  if (series?.[1]) return { name: 'series', id: series[1] }
  return { name: 'not-found' }
}

export function episodePath(id: string): string {
  return `/episodes/${id}`
}

export function seriesPath(id: string): string {
  return `/series/${id}`
}
