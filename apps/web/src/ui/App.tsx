import { fr } from '@rawiaudio/shared/ui/i18n/fr.ts'
import { CatalogPage } from './pages/CatalogPage.tsx'
import { EpisodePage } from './pages/EpisodePage.tsx'
import { SeriesPage } from './pages/SeriesPage.tsx'
import { SignInPage } from './pages/SignInPage.tsx'
import { AccountPage } from './pages/AccountPage.tsx'
import { Link, useRoute } from './navigation.tsx'
import { MiniPlayer } from './components/MiniPlayer.tsx'
import { PageTitle } from './components/PageTitle.tsx'
import { accountPath } from './router.ts'

export function App() {
  const route = useRoute()

  return (
    <>
      <header className="masthead">
        <Link href="/" className="brand">
          <img src="/img/symbole.svg" alt="" width="40" height="40" />
          <span>{fr.appName}</span>
        </Link>
        <Link href={accountPath()} className="account-link" aria-current={route.name === 'account' ? 'page' : undefined}>
          {fr.account}
        </Link>
      </header>
      <main>
        {route.name === 'catalog' && <CatalogPage />}
        {/* key : une autre fiche remet la page à zéro au lieu de garder l'état de la précédente */}
        {route.name === 'episode' && <EpisodePage key={route.id} id={route.id} />}
        {route.name === 'series' && <SeriesPage key={route.id} id={route.id} />}
        {route.name === 'signIn' && <SignInPage />}
        {route.name === 'account' && <AccountPage />}
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
