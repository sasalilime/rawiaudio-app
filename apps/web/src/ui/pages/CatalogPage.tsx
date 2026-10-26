import { fr } from '../i18n/fr.ts'
import { EpisodeRow } from '../components/EpisodeRow.tsx'
import { PageTitle } from '../components/PageTitle.tsx'
import { RandomButton } from '../components/RandomButton.tsx'
import { SeriesRow } from '../components/SeriesRow.tsx'
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
      {state.status === 'ok' && !state.data.latest && <p className="notice">{fr.emptyCatalog}</p>}
      {state.status === 'ok' && state.data.latest && (
        <>
          <RandomButton episodes={state.data.episodes} />

          <section className="latest" aria-labelledby="latest-title">
            <h2 id="latest-title" className="section-title">
              {fr.latestEpisode}
            </h2>
            <EpisodeRow episode={state.data.latest} />
          </section>

          {state.data.sections.map((section) => {
            const id = `theme-${section.theme?.id ?? 'autres'}`
            return (
              <section key={id} className="theme" aria-labelledby={id}>
                <h2 id={id} className="section-title">
                  {section.theme?.title ?? fr.otherStories}
                </h2>
                <ol className="episodes">
                  {section.items.map((item) =>
                    item.kind === 'series' ? (
                      <li key={item.series.id}>
                        <SeriesRow series={item.series} />
                      </li>
                    ) : (
                      <li key={item.episode.id}>
                        <EpisodeRow episode={item.episode} />
                      </li>
                    ),
                  )}
                </ol>
              </section>
            )
          })}
        </>
      )}
    </>
  )
}
