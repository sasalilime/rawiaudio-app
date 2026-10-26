import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react'
import { parseRoute, type Route } from './router.ts'

// L'adresse du navigateur est l'état de la navigation : on s'y abonne au lieu de la recopier dans React.
const NAVIGATE = 'rawi:navigate'

function subscribe(onChange: () => void) {
  addEventListener('popstate', onChange) // boutons précédent / suivant
  addEventListener(NAVIGATE, onChange)
  return () => {
    removeEventListener('popstate', onChange)
    removeEventListener(NAVIGATE, onChange)
  }
}

const getPathname = () => location.pathname

export function useRoute(): Route {
  return parseRoute(useSyncExternalStore(subscribe, getPathname))
}

export function navigate(path: string) {
  if (path === location.pathname) return
  history.pushState(null, '', path)
  dispatchEvent(new Event(NAVIGATE))
}

/** Lien interne : change de page sans recharger, mais laisse Ctrl+clic ouvrir un nouvel onglet. */
export function Link({ href, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)
    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate(href)
  }
  return <a href={href} onClick={handleClick} {...props} />
}
