import { NotFoundError } from '../../core/domain/errors.ts'
import { formatDuration } from '../format.ts'
import { fr } from '../i18n/fr.ts'
import { Link } from '../navigation.tsx'
import { PageTitle } from '../components/PageTitle.tsx'
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
          {state.data.series && <p className="episode-meta">{fr.series(state.data.series.title)}</p>}

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
