import { useState } from 'react'

/**
 * L'illustration 16:9 d'un épisode (ADR-0009). Décorative : le titre est toujours écrit à côté.
 * Largeur et hauteur réservent sa place avant le chargement : la page ne saute pas quand elle arrive.
 * Si elle ne se charge pas (hors ligne, épisode non téléchargé), elle disparaît : sinon le navigateur
 * dessine son icône d'image cassée, même avec alt="".
 */
export function EpisodeImage({ url, className }: { url: string; className: string }) {
  // L'adresse en échec, et pas un simple booléen : une autre adresse (autre épisode) retente sa chance.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  if (failedUrl === url) return null
  return <img className={className} src={url} alt="" width={960} height={540} decoding="async" onError={() => setFailedUrl(url)} />
}
