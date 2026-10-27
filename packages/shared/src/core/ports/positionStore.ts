/** Position d'écoute enregistrée par épisode, pour reprendre là où on s'était arrêté. Implémenté dans infra/storage. */
export interface PositionStore {
  /** null si rien n'est enregistré, ou si le stockage est indisponible. */
  get(episodeId: string): number | null
  save(episodeId: string, seconds: number): void
  clear(episodeId: string): void
}
