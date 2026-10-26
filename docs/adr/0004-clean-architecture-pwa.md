# ADR-0004 : Clean Architecture dans la PWA

**Statut :** Accepté
**Date :** 26 octobre 2026
**Décideur :** Salim

## Contexte
- La PWA va réunir le catalogue, le lecteur audio, le hors ligne, puis la connexion et l'abonnement, avec beaucoup de séries et d'épisodes.
- L'API Go suit déjà la règle de dépendance : `service` déclare ses ports, `repository` et `httpapi` sont à l'extérieur.
- La première version du catalogue mêlait l'appel HTTP et les composants React.
- Décision de Salim : Clean Architecture sur toutes les couches, avec des noms de dossiers classiques.

## Décision
- Structure de `apps/web/src` :
  - `core/domain` : entités (`Episode`, `Series`) et règles métier pures. Elles ne connaissent pas les réponses de l'API.
  - `core/ports` : interfaces vers l'extérieur (`EpisodeRepository`, plus tard `AudioPlayer`, `OfflineStore`).
  - `core/useCases` : une fonction par action (`listCatalog`, `getEpisode`…), qui reçoit ses ports en paramètre.
  - `infra/` : implémentations des ports. `infra/http` traduit les réponses de l'API en entités, et ses erreurs en erreurs du domaine (`NotFoundError`, `UnavailableError`).
  - `ui/` : React. Les pages passent par des hooks, qui appellent les cas d'usage fournis par un contexte.
  - `main.tsx` : seul fichier qui assemble `infra`, `core` et `ui`.
- Règle de dépendance :
  - `core` n'importe rien hors de `core`, ni paquet npm ;
  - `infra` n'importe que `core` ;
  - `ui` n'importe que `core` (et React).
  - `src/architecture.test.ts` lit les imports et échoue en cas de violation.
- Des fabriques de fonctions (`createListCatalog(repository)`) plutôt que des classes : le tsconfig interdit les propriétés déclarées dans un constructeur, que Node ne sait pas retirer.

## Conséquences
- Changer d'API, de stockage ou de lecteur audio ne touche que `infra/`.
- Les règles du catalogue et du lecteur se testent sans React, sans réseau et sans navigateur.
- Plus de fichiers, et des cas d'usage qui ne font d'abord que relayer le dépôt : ils prendront le rangement par série et l'état « téléchargé ».
- Les types de l'API existent deux fois : la réponse (`infra/http/types.ts`) et l'entité (`core/domain`). C'est voulu : un changement du contrat s'arrête à `infra/http`.
