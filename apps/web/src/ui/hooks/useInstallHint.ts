/**
 * Faut-il conseiller d'installer l'appli avant de télécharger ? Sur iPhone et iPad, Safari et l'appli
 * installée ont chacun leur stockage (ADR-0002) : un épisode téléchargé dans Safari n'existe pas dans l'appli.
 */
export function useInstallHint(): boolean {
  const installed = matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && navigator.standalone === true)
  // L'iPad se présente comme un Mac depuis iPadOS 13 : on le reconnaît à son écran tactile.
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  return ios && !installed
}
