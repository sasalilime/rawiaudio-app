import type { SeriesOverview } from '../../core/domain/catalog.ts'
import { formatDuration } from '../format.ts'
import { fr } from '../i18n/fr.ts'
import { useHistory } from '../hooks/useHistory.ts'
import { Link } from '../navigation.tsx'
import { seriesPath } from '../router.ts'

/** Une série dans le catalogue : une seule ligne pour toutes ses parties, qui mène à la page de la série. */
export function SeriesRow({ series }: { series: SeriesOverview }) {
  const heard = useHistory()
  const heardCount = series.parts.filter((part) => heard.has(part.id)).length

  return (
    <Link href={seriesPath(series.id)} className="episode-row series-row">
      <span className="series-count" aria-hidden="true">
        <span className="episode-number">{series.parts.length}</span>
        <span className="series-count-label">{fr.partWord(series.parts.length)}</span>
      </span>
      <span className="episode-text">
        <span className="episode-title">{series.title}</span>
        {/* Le nombre de parties est déjà dans la colonne de gauche : ici, la durée totale. */}
        <span className="episode-meta">{formatDuration(series.durationSeconds)}</span>
        {heardCount > 0 && <span className="episode-heard">{fr.seriesProgress(heardCount, series.parts.length)}</span>}
      </span>
    </Link>
  )
}
