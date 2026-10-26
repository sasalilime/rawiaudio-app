import type { EpisodeSummary } from '../../core/domain/episode.ts'
import { formatDuration } from '../format.ts'
import { fr } from '../i18n/fr.ts'
import { useDownloads } from '../hooks/useDownloads.ts'
import { Link } from '../navigation.tsx'
import { episodePath } from '../router.ts'

/** Une ligne du catalogue : toute la ligne mène à la fiche de l'épisode. */
export function EpisodeRow({ episode }: { episode: EpisodeSummary }) {
  const [downloads] = useDownloads()

  return (
    <Link href={episodePath(episode.id)} className="episode-row">
      <span className="episode-number" aria-hidden="true">
        {episode.number}
      </span>
      <span className="episode-text">
        <span className="visually-hidden">{fr.episodeNumber(episode.number)} : </span>
        <span className="episode-title">{episode.title}</span>
        <span className="episode-meta">{episode.reference}</span>
        <span className="episode-meta">{formatDuration(episode.durationSeconds)}</span>
        {downloads.get(episode.id)?.status === 'downloaded' && <span className="episode-downloaded">{fr.downloaded}</span>}
      </span>
    </Link>
  )
}
