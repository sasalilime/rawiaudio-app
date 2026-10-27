/**
 * L'historique d'écoute du compte, côté serveur (ADR-0007). Implémenté dans http/.
 * Lève une erreur hors ligne ou sans session : la synchronisation réessaiera plus tard.
 */
export interface HistoryGateway {
  /** Envoie les épisodes entendus sur l'appareil ; renvoie tout l'historique du compte. */
  sync(episodeIds: string[]): Promise<string[]>
}
