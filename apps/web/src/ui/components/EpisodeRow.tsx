import type { EpisodeSummary } from '@rawiaudio/shared/core/domain/episode.ts'
import { formatDuration } from '@rawiaudio/shared/ui/format.ts'
import { fr } from '@rawiaudio/shared/ui/i18n/fr.ts'
import { useDownloads } from '@rawiaudio/shared/ui/hooks/useDownloads.ts'
import { useHistory } from '@rawiaudio/shared/ui/hooks/useHistory.ts'
import { Link } from '../navigation.tsx'
import { episodePath } from '../router.ts'
import { EpisodeImage } from './EpisodeImage.tsx'

/**
 * Une ligne du catalogue : toute la ligne mène à la fiche de l'épisode.
 * inSeries : sur la page de sa série, le grand numéro est celui de la partie, et le nom de la série est superflu.
 * featured : en grande carte, avec l'illustration au-dessus (le dernier épisode, à l'accueil).
 */
export function EpisodeRow({ episode, inSeries = false, featured = false }: { episode: EpisodeSummary; inSeries?: boolean; featured?: boolean }) {
  const [downloads] = useDownloads()
  const heard = useHistory()
  const number = inSeries && episode.series ? episode.series.part : episode.number
  const label = inSeries && episode.series ? fr.partNumber(episode.series.part) : fr.episodeNumber(episode.number)

  return (
    <Link href={episodePath(episode.id)} className="episode-row">
      {featured && episode.imageUrl && <EpisodeImage url={episode.imageUrl} className="episode-cover" />}
      <span className="episode-number" aria-hidden="true">
        {number}
      </span>
      <span className="episode-text">
        <span className="visually-hidden">{label} : </span>
        <span className="episode-title">{episode.title}</span>
        {episode.series && !inSeries && (
          <span className="episode-meta">{fr.partOf(episode.series.part, episode.series.title)}</span>
        )}
        <span className="episode-meta">{episode.reference}</span>
        <span className="episode-meta">{formatDuration(episode.durationSeconds)}</span>
        {(heard.has(episode.id) || downloads.get(episode.id)?.status === 'downloaded') && (
          <span className="episode-marks">
            {heard.has(episode.id) && <span className="episode-heard">{fr.heard}</span>}
            {downloads.get(episode.id)?.status === 'downloaded' && (
              <span className="episode-downloaded">{fr.downloaded}</span>
            )}
          </span>
        )}
      </span>
    </Link>
  )
}
