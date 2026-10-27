import { Text, View } from 'react-native'
import type { EpisodeSummary } from '@rawiaudio/shared/core/domain/episode.ts'
import { fr } from '@rawiaudio/shared/ui/i18n/fr.ts'
import { useSeriesDownload } from '@rawiaudio/shared/ui/hooks/useSeriesDownload.ts'
import { text } from '../theme.ts'
import { Button } from './Button.tsx'
import { downloadStyles } from './DownloadButton.tsx'
import { ProgressBar } from './ProgressBar.tsx'

/** Télécharger toutes les parties d'une série d'un coup, l'une après l'autre. */
export function DownloadSeriesButton({ parts }: { parts: EpisodeSummary[] }) {
  const { done, busy, downloadAll, removeAll } = useSeriesDownload(parts)

  if (done === parts.length) {
    return (
      <View style={downloadStyles.block}>
        <Text style={text.meta}>{fr.seriesAvailableOffline}</Text>
        <Button label={fr.removeSeriesDownloads} onPress={removeAll} secondary />
      </View>
    )
  }

  if (busy) {
    return (
      <View style={downloadStyles.block}>
        <Text accessibilityLiveRegion="polite" style={text.meta}>
          {fr.seriesDownloading(done, parts.length)}
        </Text>
        <ProgressBar value={done} max={parts.length} label={fr.seriesDownloading(done, parts.length)} />
      </View>
    )
  }

  return <Button label={fr.downloadSeries(parts.length)} onPress={() => void downloadAll()} secondary />
}
