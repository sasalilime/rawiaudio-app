import { findSeries, nextPart } from '../../core/domain/catalog.ts'
import type { Episode } from '../../core/domain/episode.ts'
import { NotFoundError } from '../../core/domain/errors.ts'
import { formatDuration } from '../format.ts'
import { fr } from '../i18n/fr.ts'
import { useCatalog } from '../hooks/useCatalog.ts'
import { Link } from '../navigation.tsx'
import { episodePath, seriesPath } from '../router.ts'
import { PageTitle } from '../components/PageTitle.tsx'
import { DownloadButton } from '../components/DownloadButton.tsx'
import { PlayButton } from '../components/PlayButton.tsx'
import { useEpisode } from '../hooks/useEpisode.ts'

export function EpisodePage({ id }: { id: string }) {
  const [state, retry] = useEpisode(id)

  return (
    <>
      <Link href="/" className="back">
        {fr.backToCatalog}
      </Link>

      {state.status === 'loading' && <p role="status">{fr.loading}</p>}
      {state.status === 'error' && <EpisodeError error={state.error} retry={retry} />}
      {state.status === 'ok' && (
        <article className="episode">
          <p className="episode-number episode-number--large" aria-hidden="true">
            {state.data.number}
          </p>
          <PageTitle title={state.data.title} className="episode-heading">
            <span className="visually-hidden">{fr.episodeNumber(state.data.number)} : </span>
            {state.data.title}
          </PageTitle>
          <p className="episode-meta">{state.data.reference}</p>
          <p className="episode-meta">{formatDuration(state.data.durationSeconds)}</p>
          <SeriesInfo episode={state.data} />
          {state.data.themes.length > 0 && (
            <p className="episode-meta">{fr.themes(state.data.themes.map((theme) => theme.title))}</p>
          )}
          <PlayButton episode={state.data} />
          <DownloadButton episode={state.data} />

          {state.data.summary.length > 0 && (
            <div className="summary">
              {state.data.summary.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          )}

          {state.data.sources.length > 0 && (
            <section className="sources" aria-labelledby="sources-title">
              <h2 id="sources-title">{fr.sources}</h2>
              <p className="episode-meta">{fr.sourcesIntro}</p>
              <ul>
                {state.data.sources.map((source) => (
                  <li key={source.url + source.label}>
                    {/* dir="auto" : les intitulés sont souvent en arabe, écrits de droite à gauche. */}
                    <a href={source.url} target="_blank" rel="noopener noreferrer" dir="auto">
                      {source.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>
      )}
    </>
  )
}

function EpisodeError({ error, retry }: { error: unknown; retry: () => void }) {
  if (error instanceof NotFoundError) {
    return (
      <>
        <PageTitle title={fr.notFound} className="visually-hidden">
          {fr.notFound}
        </PageTitle>
        <p className="notice">{fr.notFound}</p>
      </>
    )
  }
  return (
    <div role="alert" className="notice">
      <p>{fr.episodeError}</p>
      <button type="button" onClick={retry}>
        {fr.retry}
      </button>
    </div>
  )
}

/** Pour une partie de série : sa place dans la série, le lien vers la série et vers la partie suivante. */
function SeriesInfo({ episode }: { episode: Episode }) {
  const [catalog] = useCatalog('fr')
  if (!episode.series) return null

  // Le catalogue donne le nombre de parties et la suivante ; sans lui (hors ligne, rien gardé), le numéro seul.
  const episodes = catalog.status === 'ok' ? catalog.data.episodes : []
  const total = findSeries(episodes, episode.series.id)?.parts.length
  const next = nextPart(episodes, episode)

  return (
    <>
      <p className="episode-meta">
        {total ? fr.partOfTotal(episode.series.part, total) : fr.partNumber(episode.series.part)}
      </p>
      <p className="episode-links">
        <Link href={seriesPath(episode.series.id)}>{fr.seriesLink(episode.series.title)}</Link>
      </p>
      {next && (
        <p className="episode-links">
          <Link href={episodePath(next.id)}>{fr.nextPartLink(next.title)}</Link>
        </p>
      )}
    </>
  )
}
