import { useState } from 'react'
import { Link } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { PlaybackStatus } from '@rawiaudio/shared/core/useCases/playbackSession.ts'
import { formatClock } from '@rawiaudio/shared/ui/format.ts'
import { fr } from '@rawiaudio/shared/ui/i18n/fr.ts'
import { usePlayback } from '@rawiaudio/shared/ui/hooks/usePlayback.ts'
import { episodeHref } from '../routes.ts'
import { colors, fonts, NUMBER_MAX_SCALE, text, TOUCH_TARGET } from '../theme.ts'

const SKIP_SECONDS = 15

const MESSAGES: Partial<Record<PlaybackStatus, string>> = {
  loading: fr.playerLoading,
  blocked: fr.playerBlocked,
  error: fr.playerError,
  ended: fr.playerEnded,
}

/** Le lecteur en bas de l'écran, visible sur tous les écrans dès qu'un épisode est lancé. */
export function MiniPlayer() {
  const [snapshot, playback] = usePlayback()
  const insets = useSafeAreaInsets()
  const [barWidth, setBarWidth] = useState(0)
  const { episode, status, position } = snapshot
  if (!episode) return null

  const running = status === 'playing' || status === 'loading'
  const duration = episode.durationSeconds
  const percent = duration > 0 ? Math.min(100, (position / duration) * 100) : 0

  return (
    <View accessibilityLabel={fr.player} style={[styles.player, { paddingBottom: insets.bottom + 8 }]}>
      <View style={styles.top}>
        <Link href={episodeHref(episode.id)} asChild>
          <Pressable accessibilityRole="link" style={styles.titleLink}>
            <Text numberOfLines={1} style={styles.title}>
              {episode.title}
            </Text>
          </Pressable>
        </Link>
        <Text style={[text.meta, styles.time]}>
          {formatClock(position)} / {formatClock(duration)}
        </Text>
      </View>

      {/* Toucher la barre place la lecture à cet endroit ; au lecteur d'écran, glisser vers le haut ou le bas saute de 15 s. */}
      <Pressable
        accessibilityRole="adjustable"
        accessibilityLabel={fr.position}
        accessibilityValue={{ text: fr.positionText(formatClock(position), formatClock(duration)) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => playback.seekBy(event.nativeEvent.actionName === 'increment' ? SKIP_SECONDS : -SKIP_SECONDS)}
        onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
        onPress={(event) => barWidth > 0 && playback.seekTo((event.nativeEvent.locationX / barWidth) * duration)}
        style={styles.track}
      >
        {/* pointerEvents none : locationX doit se mesurer sur toute la barre, pas sur le trait touché. */}
        <View pointerEvents="none" style={styles.rail}>
          <View style={[styles.fill, { width: `${percent}%` }]} />
        </View>
      </Pressable>

      <View style={styles.controls}>
        <Pressable accessibilityRole="button" accessibilityLabel={fr.backward} onPress={() => playback.seekBy(-SKIP_SECONDS)} style={styles.skip}>
          <Text maxFontSizeMultiplier={NUMBER_MAX_SCALE} style={styles.skipLabel}>
            −15
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={running ? fr.pause : fr.playLabel}
          onPress={() => playback.toggle()}
          style={styles.toggle}
        >
          {running ? <PauseIcon /> : <PlayIcon />}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={fr.forward} onPress={() => playback.seekBy(SKIP_SECONDS)} style={styles.skip}>
          <Text maxFontSizeMultiplier={NUMBER_MAX_SCALE} style={styles.skipLabel}>
            +15
          </Text>
        </Pressable>
      </View>

      {MESSAGES[status] && (
        <Text accessibilityLiveRegion="polite" style={[text.meta, styles.status]}>
          {MESSAGES[status]}
        </Text>
      )}
    </View>
  )
}

// Icônes dessinées en vues : pas de bibliothèque d'icônes ni de SVG pour deux formes.
function PlayIcon() {
  return <View style={styles.playIcon} />
}

function PauseIcon() {
  return (
    <View style={styles.pauseIcon}>
      <View style={styles.pauseBar} />
      <View style={styles.pauseBar} />
    </View>
  )
}

const styles = StyleSheet.create({
  player: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.nuit,
    borderTopWidth: 1,
    borderTopColor: colors.trait,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleLink: { flex: 1, minHeight: TOUCH_TARGET, justifyContent: 'center' },
  title: { color: colors.papier, fontFamily: fonts.titre, fontSize: 19, lineHeight: 26 },
  time: { fontVariant: ['tabular-nums'] },
  track: { height: 32, justifyContent: 'center' },
  rail: { height: 4, borderRadius: 2, backgroundColor: colors.trait, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.ambre },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 32 },
  skip: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: TOUCH_TARGET / 2,
    borderWidth: 1,
    borderColor: colors.trait,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipLabel: { color: colors.papier, fontFamily: fonts.texteAppuye, fontSize: 15, lineHeight: 20 },
  toggle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.ambre,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Triangle en bordures, décalé vers la droite pour paraître centré.
  playIcon: {
    marginLeft: 4,
    borderLeftWidth: 18,
    borderLeftColor: colors.nuit,
    borderTopWidth: 11,
    borderTopColor: 'transparent',
    borderBottomWidth: 11,
    borderBottomColor: 'transparent',
  },
  pauseIcon: { flexDirection: 'row', gap: 6 },
  pauseBar: { width: 6, height: 20, borderRadius: 1, backgroundColor: colors.nuit },
  status: { textAlign: 'center', marginTop: 4 },
})
