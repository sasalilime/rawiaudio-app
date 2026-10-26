import type { EpisodeSummary } from '../../core/domain/episode.ts'
import { fr } from '../i18n/fr.ts'
import { useDownloads } from '../hooks/useDownloads.ts'
import { useInstallHint } from '../hooks/useInstallHint.ts'

/** Télécharger toutes les parties d'une série d'un coup, l'une après l'autre. */
export function DownloadSeriesButton({ parts }: { parts: EpisodeSummary[] }) {
  const [downloads, manager] = useDownloads()
  const showInstallHint = useInstallHint()
  const done = parts.filter((part) => downloads.get(part.id)?.status === 'downloaded').length
  const busy = parts.some((part) => downloads.get(part.id)?.status === 'downloading')

  if (done === parts.length) {
    return (
      <div className="download">
        <p className="download-done">{fr.seriesAvailableOffline}</p>
        <button type="button" className="secondary" onClick={() => parts.forEach((part) => void manager.remove(part.id))}>
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

  async function downloadAll() {
    // L'une après l'autre : sur un téléphone, plusieurs téléchargements en parallèle se gênent.
    for (const part of parts) {
      if (manager.getSnapshot().get(part.id)?.status !== 'downloaded') await manager.download(part)
    }
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
