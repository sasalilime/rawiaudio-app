import type { EpisodeSummary } from '@rawiaudio/shared/core/domain/episode.ts'
import { usePlayButton } from '@rawiaudio/shared/ui/hooks/usePlayButton.ts'

/** Le bouton principal de la fiche : écouter, reprendre ou mettre en pause cet épisode. */
export function PlayButton({ episode }: { episode: EpisodeSummary }) {
  const [label, press] = usePlayButton(episode)

  return (
    // Appel direct dans le clic, sans rien attendre avant : sinon iOS refuse de lancer le son.
    <button type="button" className="play-button" onClick={press}>
      {label}
    </button>
  )
}
