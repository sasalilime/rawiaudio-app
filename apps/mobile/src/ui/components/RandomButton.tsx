import { Text } from 'react-native'
import type { EpisodeSummary } from '@rawiaudio/shared/core/domain/episode.ts'
import { fr } from '@rawiaudio/shared/ui/i18n/fr.ts'
import { useRandomPick } from '@rawiaudio/shared/ui/hooks/useRandomPick.ts'
import { useOnline } from '../hooks/useOnline.ts'
import { text } from '../theme.ts'
import { Button } from './Button.tsx'

/** « Une histoire au hasard » (ADR-0007), tirée d'avance : le geste lance le son sans attente. */
export function RandomButton({ episodes }: { episodes: EpisodeSummary[] }) {
  const [pick, play] = useRandomPick(episodes, useOnline())

  if (!pick) return <Text style={text.meta}>{fr.randomUnavailable}</Text>
  return <Button label={fr.random} onPress={play} />
}
