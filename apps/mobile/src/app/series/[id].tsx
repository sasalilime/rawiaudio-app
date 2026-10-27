import { useLocalSearchParams } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { findSeries } from '@rawiaudio/shared/core/domain/catalog.ts'
import { formatDuration } from '@rawiaudio/shared/ui/format.ts'
import { fr } from '@rawiaudio/shared/ui/i18n/fr.ts'
import { useCatalog } from '@rawiaudio/shared/ui/hooks/useCatalog.ts'
import { useHistory } from '@rawiaudio/shared/ui/hooks/useHistory.ts'
import { DownloadSeriesButton } from '../../ui/components/DownloadSeriesButton.tsx'
import { EpisodeRow, rowStyles } from '../../ui/components/EpisodeRow.tsx'
import { ErrorNotice } from '../../ui/components/ErrorNotice.tsx'
import { PlayButton } from '../../ui/components/PlayButton.tsx'
import { colors, fonts, screen, text } from '../../ui/theme.ts'

/** Une série : ses parties dans l'ordre, la prochaine à écouter, et le téléchargement de l'ensemble. */
export default function SeriesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [state, retry] = useCatalog('fr')
  const heard = useHistory()
  const series = state.status === 'ok' ? findSeries(state.data.episodes, id) : null

  if (state.status === 'loading') {
    return (
      <ScrollView contentContainerStyle={screen.content}>
        <Text accessibilityLiveRegion="polite" style={text.meta}>
          {fr.loading}
        </Text>
      </ScrollView>
    )
  }
  if (!series) {
    return (
      <ScrollView contentContainerStyle={screen.content}>
        {state.status === 'error' ? <ErrorNotice message={fr.loadError} retry={retry} /> : <Text style={text.body}>{fr.seriesNotFound}</Text>}
      </ScrollView>
    )
  }

  // La prochaine partie pas encore entendue ; la première si tout a été entendu.
  const next = series.parts.find((part) => !heard.has(part.id)) ?? series.parts[0]
  const heardCount = series.parts.filter((part) => heard.has(part.id)).length

  return (
    <ScrollView contentContainerStyle={screen.content}>
      <Text accessibilityRole="header" style={text.title}>
        {series.title}
      </Text>
      <Text style={text.meta}>
        {fr.partCount(series.parts.length)}, {formatDuration(series.durationSeconds)}
      </Text>
      {heardCount > 0 && <Text style={text.meta}>{fr.seriesProgress(heardCount, series.parts.length)}</Text>}

      <View style={styles.actions}>
        {next?.series && (
          <>
            <Text style={styles.next}>
              {fr.partWithTitle(next.series.part, next.title)}
            </Text>
            <PlayButton episode={next} />
          </>
        )}
        <DownloadSeriesButton parts={series.parts} />
      </View>

      <View style={rowStyles.list}>
        {series.parts.map((part) => (
          <EpisodeRow key={part.id} episode={part} inSeries />
        ))}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  actions: { gap: 12, marginTop: 12, marginBottom: 24 },
  next: { color: colors.papier, fontFamily: fonts.texteAppuye, fontSize: 18, lineHeight: 28 },
})
