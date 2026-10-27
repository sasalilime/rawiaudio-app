import { StyleSheet, Text, View } from 'react-native'
import type { EpisodeSummary } from '@rawiaudio/shared/core/domain/episode.ts'
import { fr } from '@rawiaudio/shared/ui/i18n/fr.ts'
import { useDownloads } from '@rawiaudio/shared/ui/hooks/useDownloads.ts'
import { text } from '../theme.ts'
import { Button } from './Button.tsx'
import { ProgressBar } from './ProgressBar.tsx'

/** Télécharger un épisode pour l'écouter sans connexion, suivre la progression, ou le supprimer. */
export function DownloadButton({ episode }: { episode: EpisodeSummary }) {
  const [downloads, manager] = useDownloads()
  const state = downloads.get(episode.id)

  if (state?.status === 'downloaded') {
    return (
      <View style={downloadStyles.block}>
        <Text style={text.meta}>{fr.availableOffline}</Text>
        <Button label={fr.removeDownload} onPress={() => void manager.remove(episode.id)} secondary />
      </View>
    )
  }

  if (state?.status === 'downloading') {
    const percent = state.progress === null ? null : Math.round(state.progress * 100)
    return (
      <View style={downloadStyles.block}>
        <Text accessibilityLiveRegion="polite" style={text.meta}>
          {fr.downloading(percent)}
        </Text>
        <ProgressBar value={percent ?? 0} max={100} label={fr.downloading(null)} />
      </View>
    )
  }

  return (
    <View style={downloadStyles.block}>
      {state?.status === 'error' && (
        <Text accessibilityRole="alert" style={text.meta}>
          {fr.downloadError}
        </Text>
      )}
      <Button
        label={state?.status === 'error' ? fr.retryDownload : fr.download}
        onPress={() => void manager.download(episode)}
        secondary
      />
    </View>
  )
}

export const downloadStyles = StyleSheet.create({
  block: { gap: 8 },
})
