// Règles de la lecture audio, sans navigateur ni réseau.

/** URL temporaire d'un fichier audio (ADR-0003). */
export interface AudioUrl {
  url: string
  expiresAt: Date
}

/**
 * En dessous de cette marge avant l'expiration, on redemande une URL :
 * le navigateur fait plusieurs requêtes pendant la lecture, chacune doit encore être acceptée.
 */
export const URL_SAFETY_MARGIN_MS = 60_000

export function isUrlUsable(audio: AudioUrl, now: Date): boolean {
  return audio.expiresAt.getTime() - now.getTime() > URL_SAFETY_MARGIN_MS
}

/** Écart au début ou à la fin en deçà duquel on repart du début plutôt que de reprendre. */
const RESUME_EDGE_SECONDS = 5

/** Position de reprise : la position enregistrée, sauf tout au début ou tout à la fin (épisode fini). */
export function resumePosition(saved: number | null, durationSeconds: number): number {
  if (saved === null || !Number.isFinite(saved)) return 0
  if (saved < RESUME_EDGE_SECONDS || saved > durationSeconds - RESUME_EDGE_SECONDS) return 0
  return saved
}

/** Une position toujours comprise entre 0 et la durée de l'épisode. */
export function clampPosition(seconds: number, durationSeconds: number): number {
  return Math.min(Math.max(seconds, 0), durationSeconds)
}
