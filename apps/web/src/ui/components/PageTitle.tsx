import { useEffect, useRef, type ReactNode } from 'react'
import { fr } from '../i18n/fr.ts'

/**
 * Titre de page : met à jour l'onglet et reçoit le focus à chaque changement de page,
 * pour qu'un lecteur d'écran annonce la nouvelle page comme après un vrai chargement.
 */
export function PageTitle({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    document.title = title === fr.appName ? title : `${title} | ${fr.appName}`
    ref.current?.focus({ preventScroll: true })
    scrollTo(0, 0)
  }, [title])

  return (
    <h1 ref={ref} tabIndex={-1} className={className}>
      {children}
    </h1>
  )
}
