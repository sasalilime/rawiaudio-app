/** Les épisodes entendus, gardés sur l'appareil (ADR-0007). Implémenté dans infra/storage. */
export interface HistoryStore {
  /** Identifiants des épisodes entendus ; liste vide si le stockage est indisponible. */
  load(): string[]
  save(episodeIds: string[]): void
}
