// Les adresses des écrans (dossier app/ d'expo-router), écrites une seule fois.
export const episodeHref = (id: string) => ({ pathname: '/episode/[id]', params: { id } }) as const
export const seriesHref = (id: string) => ({ pathname: '/series/[id]', params: { id } }) as const
