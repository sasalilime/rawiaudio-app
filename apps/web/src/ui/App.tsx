import { fr } from '@rawiaudio/shared/ui/i18n/fr.ts'
import { CatalogPage } from './pages/CatalogPage.tsx'
import { EpisodePage } from './pages/EpisodePage.tsx'
import { SeriesPage } from './pages/SeriesPage.tsx'
import { Link, useRoute } from './navigation.tsx'
import { MiniPlayer } from './components/MiniPlayer.tsx'
import { PageTitle } from './components/PageTitle.tsx'

export function App() {
  const route = useRoute()

  return (
    <>
      <header className="masthead">
        <Link href="/" className="brand">
          <img src="/img/symbole.svg" alt="" width="40" height="40" />
          <span>{fr.appName}</span>
        </Link>
      </header>
      <main>
        {route.name === 'catalog' && <CatalogPage />}
        {/* key : une autre fiche remet la page à zéro au lieu de garder l'état de la précédente */}
        {route.name === 'episode' && <EpisodePage key={route.id} id={route.id} />}
        {route.name === 'series' && <SeriesPage key={route.id} id={route.id} />}
        {route.name === 'not-found' && (
          <>
            <PageTitle title={fr.pageNotFound}>{fr.pageNotFound}</PageTitle>
            <Link href="/">{fr.backToCatalog}</Link>
          </>
        )}
      </main>
      <MiniPlayer />
    </>
  )
}
