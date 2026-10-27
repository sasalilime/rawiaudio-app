import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { SeriesOverview } from '@rawiaudio/shared/core/domain/catalog.ts'
import { formatDuration } from '@rawiaudio/shared/ui/format.ts'
import { fr } from '@rawiaudio/shared/ui/i18n/fr.ts'
import { useHistory } from '@rawiaudio/shared/ui/hooks/useHistory.ts'
import { seriesHref } from '../routes.ts'
import { NUMBER_MAX_SCALE, text } from '../theme.ts'
import { rowStyles } from './EpisodeRow.tsx'

/** Une série dans le catalogue : une seule ligne pour toutes ses parties, qui mène à la page de la série. */
export function SeriesRow({ series }: { series: SeriesOverview }) {
  const heard = useHistory()
  const heardCount = series.parts.filter((part) => heard.has(part.id)).length
  const progress = heardCount > 0 ? fr.seriesProgress(heardCount, series.parts.length) : null

  return (
    // Pas de <Link asChild> : il fusionne les styles en objet et perd le style qui dépend de « pressed ».
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push(seriesHref(series.id))}
      accessibilityLabel={[series.title, fr.partCount(series.parts.length), formatDuration(series.durationSeconds), progress]
        .filter((part) => part !== null)
        .join(', ')}
      style={({ pressed }) => [rowStyles.row, pressed && rowStyles.pressed]}
    >
      <View style={rowStyles.line}>
        <View style={rowStyles.number}>
          <Text maxFontSizeMultiplier={NUMBER_MAX_SCALE} style={[text.number, styles.count]}>
            {series.parts.length}
          </Text>
          <Text maxFontSizeMultiplier={NUMBER_MAX_SCALE} style={[text.meta, styles.count]}>
            {fr.partWord(series.parts.length)}
          </Text>
        </View>
        <View style={rowStyles.texts}>
          <Text style={rowStyles.title}>{series.title}</Text>
          {/* Le nombre de parties est déjà à gauche : ici, la durée totale. */}
          <Text style={text.meta}>{formatDuration(series.durationSeconds)}</Text>
          {progress && <Text style={rowStyles.marks}>{progress}</Text>}
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  count: { textAlign: 'right' },
})
