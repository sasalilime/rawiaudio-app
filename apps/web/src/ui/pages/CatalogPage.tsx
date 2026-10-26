import { formatDuration } from '../format.ts'
import { fr } from '../i18n/fr.ts'
import { episodePath } from '../router.ts'
import { Link } from '../navigation.tsx'
import { PageTitle } from '../components/PageTitle.tsx'
import { useCatalog } from '../hooks/useCatalog.ts'

export function CatalogPage() {
  const [state, retry] = useCatalog('fr')

  return (
    <>
      <PageTitle title={fr.appName} className="visually-hidden">
        {fr.catalogTitle}
      </PageTitle>
      <p className="tagline">{fr.tagline}</p>

      {state.status === 'loading' && <p role="status">{fr.loading}</p>}
      {state.status === 'error' && (
        <div role="alert" className="notice">
          <p>{fr.loadError}</p>
          <button type="button" onClick={retry}>
            {fr.retry}
          </button>
        </div>
      )}
      {state.status === 'ok' && state.data.length === 0 && <p className="notice">{fr.emptyCatalog}</p>}
      {state.status === 'ok' && state.data.length > 0 && (
        <ol className="episodes">
          {state.data.map((episode) => (
            <li key={episode.id}>
              <Link href={episodePath(episode.id)} className="episode-row">
                <span className="episode-number" aria-hidden="true">
                  {episode.number}
                </span>
                <span className="episode-text">
                  <span className="visually-hidden">{fr.episodeNumber(episode.number)} : </span>
                  <span className="episode-title">{episode.title}</span>
                  <span className="episode-meta">{episode.reference}</span>
                  <span className="episode-meta">{formatDuration(episode.durationSeconds)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </>
  )
}
