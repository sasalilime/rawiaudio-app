import { Fragment } from 'react'
import { Link } from 'expo-router'
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { fr } from '@rawiaudio/shared/ui/i18n/fr.ts'
import { useCatalog } from '@rawiaudio/shared/ui/hooks/useCatalog.ts'
import { EpisodeRow, rowStyles } from '../ui/components/EpisodeRow.tsx'
import { ErrorNotice } from '../ui/components/ErrorNotice.tsx'
import { RandomButton } from '../ui/components/RandomButton.tsx'
import { SeriesRow } from '../ui/components/SeriesRow.tsx'
import { colors, fonts, screen, text } from '../ui/theme.ts'

/** Le catalogue : l'histoire au hasard, le dernier épisode, puis les épisodes et séries rangés par thème. */
export default function CatalogScreen() {
  const [state, retry] = useCatalog('fr')
  const insets = useSafeAreaInsets()

  // ponytail: ScrollView rend toutes les lignes ; FlatList quand le catalogue en comptera des centaines.
  return (
    <ScrollView contentContainerStyle={[screen.content, { paddingTop: insets.top + 32 }]}>
      {/* En-tête de l'accueil du site : le symbole, le nom, l'accroche. */}
      <View style={styles.brand}>
        <Image source={require<number>('../../assets/images/symbole.png')} style={styles.symbol} accessibilityIgnoresInvertColors />
        <Text accessibilityRole="header" style={styles.name}>
          {fr.appName}
        </Text>
        <Text style={styles.tagline}>{fr.tagline}</Text>
      </View>

      {state.status === 'loading' && (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.ambre} />
          <Text accessibilityLiveRegion="polite" style={text.meta}>
            {fr.loading}
          </Text>
        </View>
      )}
      {state.status === 'error' && <ErrorNotice message={fr.loadError} retry={retry} />}
      {state.status === 'ok' && !state.data.latest && <Text style={text.body}>{fr.emptyCatalog}</Text>}
      {state.status === 'ok' && state.data.latest && (
        <>
          <RandomButton episodes={state.data.episodes} />

          <Text accessibilityRole="header" style={[text.sectionTitle, styles.latestTitle]}>
            {fr.latestEpisode}
          </Text>
          <EpisodeRow episode={state.data.latest} framed />

          {state.data.sections.map((section) => (
            <Fragment key={section.theme?.id ?? 'autres'}>
              <Text accessibilityRole="header" style={text.sectionTitle}>
                {section.theme?.title ?? fr.otherStories}
              </Text>
              <View style={rowStyles.list}>
                {section.items.map((item) =>
                  item.kind === 'series' ? (
                    <SeriesRow key={item.series.id} series={item.series} />
                  ) : (
                    <EpisodeRow key={item.episode.id} episode={item.episode} />
                  ),
                )}
              </View>
            </Fragment>
          ))}
        </>
      )}

      <Link href="/about" style={[text.link, styles.about]}>
        {fr.about}
      </Link>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center', gap: 12, marginBottom: 24 },
  symbol: { width: 132, height: 93 },
  name: { color: colors.papier, fontFamily: fonts.texteAppuye, fontSize: 30, lineHeight: 38, marginTop: 8 },
  tagline: { color: colors.ambre, fontFamily: fonts.titre, fontSize: 21, lineHeight: 32, textAlign: 'center', maxWidth: 320 },
  loading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 24 },
  latestTitle: { color: colors.ambre },
  // 26 de hauteur de ligne + 2 × 11 : la cible de 48 points.
  about: { alignSelf: 'center', marginTop: 32, paddingVertical: 11 },
})
