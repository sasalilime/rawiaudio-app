import { findSeries } from '@rawiaudio/shared/core/domain/catalog.ts'
import { formatDuration } from '@rawiaudio/shared/ui/format.ts'
import { fr } from '@rawiaudio/shared/ui/i18n/fr.ts'
import { DownloadSeriesButton } from '../components/DownloadSeriesButton.tsx'
import { EpisodeRow } from '../components/EpisodeRow.tsx'
import { PageTitle } from '../components/PageTitle.tsx'
import { PlayButton } from '../components/PlayButton.tsx'
import { useCatalog } from '@rawiaudio/shared/ui/hooks/useCatalog.ts'
import { useHistory } from '@rawiaudio/shared/ui/hooks/useHistory.ts'
import { Link } from '../navigation.tsx'

/** Une série : ses parties dans l'ordre, la prochaine à écouter, et le téléchargement de l'ensemble. */
export function SeriesPage({ id }: { id: string }) {
  const [state, retry] = useCatalog('fr')
  const heard = useHistory()

  if (state.status === 'loading') return <p role="status">{fr.loading}</p>
  if (state.status === 'error') {
    return (
      <div role="alert" className="notice">
        <p>{fr.loadError}</p>
        <button type="button" onClick={retry}>
          {fr.retry}
        </button>
      </div>
    )
  }

  const series = findSeries(state.data.episodes, id)
  if (!series) {
    return (
      <>
        <PageTitle title={fr.seriesNotFound}>{fr.seriesNotFound}</PageTitle>
        <Link href="/">{fr.backToCatalog}</Link>
      </>
    )
  }

  // La prochaine partie pas encore entendue ; la première si tout a été entendu.
  const next = series.parts.find((part) => !heard.has(part.id)) ?? series.parts[0]
  const heardCount = series.parts.filter((part) => heard.has(part.id)).length

  return (
    <>
      <Link href="/" className="back">
        {fr.backToCatalog}
      </Link>
      <article className="episode">
        <PageTitle title={series.title} className="episode-heading">
          {series.title}
        </PageTitle>
        <p className="episode-meta">
          {fr.partCount(series.parts.length)}, {formatDuration(series.durationSeconds)}
        </p>
        {heardCount > 0 && <p className="episode-meta">{fr.seriesProgress(heardCount, series.parts.length)}</p>}

        {next?.series && (
          <>
            <p className="series-next">
              {fr.partWithTitle(next.series.part, next.title)}
            </p>
            <PlayButton episode={next} />
          </>
        )}
        <DownloadSeriesButton parts={series.parts} />

        <ol className="episodes series-parts">
          {series.parts.map((part) => (
            <li key={part.id}>
              <EpisodeRow episode={part} inSeries />
            </li>
          ))}
        </ol>
      </article>
    </>
  )
}
