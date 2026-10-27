import type { EpisodeSummary } from '@rawiaudio/shared/core/domain/episode.ts'
import { fr } from '@rawiaudio/shared/ui/i18n/fr.ts'
import { useDownloads } from '@rawiaudio/shared/ui/hooks/useDownloads.ts'
import { useInstallHint } from '../hooks/useInstallHint.ts'

/** Télécharger un épisode pour l'écouter sans connexion, suivre la progression, ou le supprimer. */
export function DownloadButton({ episode }: { episode: EpisodeSummary }) {
  const [downloads, manager] = useDownloads()
  const showInstallHint = useInstallHint()
  const state = downloads.get(episode.id)

  if (state?.status === 'downloaded') {
    return (
      <div className="download">
        <p className="download-done">{fr.availableOffline}</p>
        <button type="button" className="secondary" onClick={() => void manager.remove(episode.id)}>
          {fr.removeDownload}
        </button>
      </div>
    )
  }

  if (state?.status === 'downloading') {
    const percent = state.progress === null ? null : Math.round(state.progress * 100)
    return (
      <div className="download">
        <p role="status">{fr.downloading(percent)}</p>
        <progress max={100} value={percent ?? undefined} aria-label={fr.downloading(null)} />
      </div>
    )
  }

  return (
    <div className="download">
      {showInstallHint && <p className="download-hint">{fr.installHint}</p>}
      {state?.status === 'error' && <p role="alert">{fr.downloadError}</p>}
      <button type="button" className="secondary" onClick={() => void manager.download(episode)}>
        {state?.status === 'error' ? fr.retryDownload : fr.download}
      </button>
    </div>
  )
}
