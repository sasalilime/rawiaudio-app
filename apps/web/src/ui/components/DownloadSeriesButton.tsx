import type { EpisodeSummary } from '@rawiaudio/shared/core/domain/episode.ts'
import { fr } from '@rawiaudio/shared/ui/i18n/fr.ts'
import { useSeriesDownload } from '@rawiaudio/shared/ui/hooks/useSeriesDownload.ts'
import { useInstallHint } from '../hooks/useInstallHint.ts'

/** Télécharger toutes les parties d'une série d'un coup, l'une après l'autre. */
export function DownloadSeriesButton({ parts }: { parts: EpisodeSummary[] }) {
  const { done, busy, downloadAll, removeAll } = useSeriesDownload(parts)
  const showInstallHint = useInstallHint()

  if (done === parts.length) {
    return (
      <div className="download">
        <p className="download-done">{fr.seriesAvailableOffline}</p>
        <button type="button" className="secondary" onClick={removeAll}>
          {fr.removeSeriesDownloads}
        </button>
      </div>
    )
  }

  if (busy) {
    return (
      <div className="download">
        <p role="status">{fr.seriesDownloading(done, parts.length)}</p>
        <progress max={parts.length} value={done} aria-label={fr.seriesDownloading(done, parts.length)} />
      </div>
    )
  }

  return (
    <div className="download">
      {showInstallHint && <p className="download-hint">{fr.installHint}</p>}
      <button type="button" className="secondary" onClick={() => void downloadAll()}>
        {fr.downloadSeries(parts.length)}
      </button>
    </div>
  )
}
