import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { EpisodeSummary } from '@rawiaudio/shared/core/domain/episode.ts'
import { formatDuration } from '@rawiaudio/shared/ui/format.ts'
import { fr } from '@rawiaudio/shared/ui/i18n/fr.ts'
import { useDownloads } from '@rawiaudio/shared/ui/hooks/useDownloads.ts'
import { useHistory } from '@rawiaudio/shared/ui/hooks/useHistory.ts'
import { episodeHref } from '../routes.ts'
import { colors, fonts, NUMBER_MAX_SCALE, text, TOUCH_TARGET } from '../theme.ts'

/**
 * Une ligne du catalogue : toute la ligne mène à la fiche de l'épisode.
 * inSeries : sur la page de sa série, le grand numéro est celui de la partie, et le nom de la série est superflu.
 * framed : encadrée d'ambre, pour le dernier épisode, celui qu'on écoute d'abord.
 */
export function EpisodeRow({ episode, inSeries = false, framed = false }: { episode: EpisodeSummary; inSeries?: boolean; framed?: boolean }) {
  const [downloads] = useDownloads()
  const heard = useHistory()
  const number = inSeries && episode.series ? episode.series.part : episode.number
  const label = inSeries && episode.series ? fr.partNumber(episode.series.part) : fr.episodeNumber(episode.number)
  const lines = [
    episode.series && !inSeries ? fr.partOf(episode.series.part, episode.series.title) : null,
    episode.reference,
    formatDuration(episode.durationSeconds),
  ].filter((line) => line !== null)
  const marks = [heard.has(episode.id) ? fr.heard : null, downloads.get(episode.id)?.status === 'downloaded' ? fr.downloaded : null].filter(
    (mark) => mark !== null,
  )

  return (
    // Pas de <Link asChild> : il fusionne les styles en objet et perd le style qui dépend de « pressed ».
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push(episodeHref(episode.id))}
      // Une seule annonce pour toute la ligne, dans l'ordre de lecture.
      accessibilityLabel={[`${label} : ${episode.title}`, ...lines, ...marks].join(', ')}
      style={({ pressed }) => [rowStyles.row, framed && rowStyles.framed, pressed && rowStyles.pressed]}
    >
      <Text maxFontSizeMultiplier={NUMBER_MAX_SCALE} style={[text.number, rowStyles.number]}>
        {number}
      </Text>
      <View style={rowStyles.texts}>
        <Text style={rowStyles.title}>{episode.title}</Text>
        {lines.map((line) => (
          <Text key={line} style={text.meta}>
            {line}
          </Text>
        ))}
        {marks.length > 0 && (
          <View style={rowStyles.marksRow}>
            {marks.map((mark) => (
              <Text key={mark} style={rowStyles.marks}>
                {mark}
              </Text>
            ))}
          </View>
        )}
      </View>
    </Pressable>
  )
}

export const rowStyles = StyleSheet.create({
  /** Autour d'une suite de lignes : le filet du haut, comme sur la PWA. */
  list: { borderTopWidth: 1, borderTopColor: colors.trait },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    minHeight: TOUCH_TARGET,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.trait,
  },
  framed: { borderTopWidth: 1, borderTopColor: colors.ambre, borderBottomColor: colors.ambre },
  pressed: { opacity: 0.7 },
  number: { width: 56, textAlign: 'right' },
  texts: { flex: 1, gap: 2, paddingTop: 4 },
  title: { color: colors.papier, fontFamily: fonts.titre, fontSize: 23, lineHeight: 30 },
  marksRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16 },
  marks: { color: colors.ambre, fontFamily: fonts.texte, fontSize: 14, lineHeight: 22 },
})
