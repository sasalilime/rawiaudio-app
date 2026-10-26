/** Durée d'un épisode pour la liste : « 7 min » (arrondie, jamais 0). */
export function formatDuration(seconds: number): string {
  return `${Math.max(1, Math.round(seconds / 60))} min`
}

/** Position dans le lecteur : « 3:07 », ou « 1:02:05 » au-delà d'une heure. */
export function formatClock(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}
