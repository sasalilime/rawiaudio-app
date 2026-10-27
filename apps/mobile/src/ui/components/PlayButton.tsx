import type { EpisodeSummary } from '@rawiaudio/shared/core/domain/episode.ts'
import { usePlayButton } from '@rawiaudio/shared/ui/hooks/usePlayButton.ts'
import { Button } from './Button.tsx'

/** Le bouton principal de la fiche : écouter, reprendre ou mettre en pause cet épisode. */
export function PlayButton({ episode }: { episode: EpisodeSummary }) {
  const [label, press] = usePlayButton(episode)
  return <Button label={label} onPress={press} />
}
