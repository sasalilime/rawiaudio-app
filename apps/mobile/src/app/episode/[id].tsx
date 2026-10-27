import { Link, useLocalSearchParams } from 'expo-router'
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { findSeries, nextPart } from '@rawiaudio/shared/core/domain/catalog.ts'
import type { Episode } from '@rawiaudio/shared/core/domain/episode.ts'
import { NotFoundError } from '@rawiaudio/shared/core/domain/errors.ts'
import { formatDuration } from '@rawiaudio/shared/ui/format.ts'
import { fr } from '@rawiaudio/shared/ui/i18n/fr.ts'
import { useCatalog } from '@rawiaudio/shared/ui/hooks/useCatalog.ts'
import { useEpisode } from '@rawiaudio/shared/ui/hooks/useEpisode.ts'
import { DownloadButton } from '../../ui/components/DownloadButton.tsx'
import { ErrorNotice } from '../../ui/components/ErrorNotice.tsx'
import { PlayButton } from '../../ui/components/PlayButton.tsx'
import { episodeHref, seriesHref } from '../../ui/routes.ts'
import { colors, fonts, NUMBER_MAX_SCALE, screen, text, TOUCH_TARGET } from '../../ui/theme.ts'

/** La fiche d'un épisode : écouter, télécharger, le résumé et les sources. */
export default function EpisodeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [state, retry] = useEpisode(id)

  return (
    <ScrollView contentContainerStyle={screen.content}>

      {state.status === 'loading' && (
        <Text accessibilityLiveRegion="polite" style={text.meta}>
          {fr.loading}
        </Text>
      )}
      {state.status === 'error' &&
        (state.error instanceof NotFoundError ? (
          <Text style={text.body}>{fr.notFound}</Text>
        ) : (
          <ErrorNotice message={fr.episodeError} retry={retry} />
        ))}
      {state.status === 'ok' && (
        <>
          <Text
            maxFontSizeMultiplier={NUMBER_MAX_SCALE}
            style={[text.number, styles.bigNumber]}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            {state.data.number}
          </Text>
          <Text accessibilityRole="header" accessibilityLabel={`${fr.episodeNumber(state.data.number)} : ${state.data.title}`} style={text.title}>
            {state.data.title}
          </Text>
          <Text style={text.meta}>{state.data.reference}</Text>
          <Text style={text.meta}>{formatDuration(state.data.durationSeconds)}</Text>
          <SeriesInfo episode={state.data} />
          {state.data.themes.length > 0 && (
            <Text style={text.meta}>{fr.themes(state.data.themes.map((theme) => theme.title))}</Text>
          )}

          <View style={styles.actions}>
            <PlayButton episode={state.data} />
            <DownloadButton episode={state.data} />
          </View>

          {state.data.summary.map((paragraph, i) => (
            <Text key={i} style={text.body}>
              {paragraph}
            </Text>
          ))}

          {state.data.sources.length > 0 && (
            <View style={styles.sources}>
              <Text accessibilityRole="header" style={[text.sectionTitle, styles.sourcesTitle]}>
                {fr.sources}
              </Text>
              <Text style={text.meta}>{fr.sourcesIntro}</Text>
              {state.data.sources.map((source) => (
                <Pressable
                  key={source.url + source.label}
                  accessibilityRole="link"
                  onPress={() => void Linking.openURL(source.url)}
                  style={styles.source}
                >
                  {/* Les intitulés sont souvent en arabe : le texte natif choisit seul le sens d'écriture. */}
                  <Text style={text.link}>{source.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  )
}

/** Pour une partie de série : sa place dans la série, le lien vers la série et vers la partie suivante. */
function SeriesInfo({ episode }: { episode: Episode }) {
  const [catalog] = useCatalog('fr')
  if (!episode.series) return null

  // Le catalogue donne le nombre de parties et la suivante ; sans lui (hors ligne, rien gardé), le numéro seul.
  const episodes = catalog.status === 'ok' ? catalog.data.episodes : []
  const total = findSeries(episodes, episode.series.id)?.parts.length
  const next = nextPart(episodes, episode)

  return (
    <>
      <Text style={text.meta}>{total ? fr.partOfTotal(episode.series.part, total) : fr.partNumber(episode.series.part)}</Text>
      <Link href={seriesHref(episode.series.id)} style={[text.link, styles.link]}>
        {fr.seriesLink(episode.series.title)}
      </Link>
      {next && (
        <Link href={episodeHref(next.id)} style={[text.link, styles.link]}>
          {fr.nextPartLink(next.title)}
        </Link>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  bigNumber: { fontSize: 80, lineHeight: 88 },
  actions: { gap: 12, marginTop: 12, marginBottom: 16 },
  sources: { gap: 8, marginTop: 24, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.trait },
  sourcesTitle: { marginTop: 16 },
  source: { minHeight: TOUCH_TARGET, justifyContent: 'center' },
  link: { paddingVertical: 10, fontFamily: fonts.texte },
})
