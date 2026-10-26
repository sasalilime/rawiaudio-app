# ADR-0006 : Rangement du catalogue par thème

**Statut :** Accepté (noms des thèmes et rattachement des épisodes 1 à 4 à valider)
**Date :** 26 octobre 2026
**Décideur :** Salim

## Contexte
- Une liste unique d'épisodes ne tiendra pas quand il y en aura des dizaines.
- Décision de Salim : les familles cherchent une histoire **par thème**.
- Le studio a déjà 10 thèmes, ceux de sa matrice de sources (`studio/docs/sources.md`).

## Décision
- **Base** :
  - une table `themes` (identifiant `<langue>-<slug>`, titre, ordre d'affichage par langue) ;
  - une table de liaison `episode_themes` : **plusieurs thèmes par épisode** ;
  - des clés étrangères sur la paire (identifiant, langue), qui interdisent de ranger un épisode dans un thème d'une autre langue.
- **API** : chaque épisode porte ses `themes` (`id`, `title`, `position`). Pas de route `/themes` : la PWA range elle-même.
- **PWA** : la règle de domaine `arrangeCatalog` produit :
  - le dernier épisode sorti, mis en avant ;
  - une section par thème, dans l'ordre des thèmes ;
  - « Autres histoires » pour les épisodes sans thème, toujours en dernier.

  Un épisode de plusieurs thèmes apparaît dans chacun.
- **Séries** : gardées telles quelles, et affichées sur la fiche. Elles ne servent pas au rangement.
- **Contenu** : les 10 thèmes du studio, avec des noms simplifiés pour les familles (`ops/episodes/0002-themes.sql`). Un nom se change par un `UPDATE`.

## Conséquences
- Toutes les sections affichent tous leurs épisodes. Au-delà d'une dizaine d'épisodes par thème, il faudra une page par thème (`/themes/{slug}`) et des sections raccourcies.
- Le dernier épisode figure deux fois sur l'accueil : mis en avant, et dans ses thèmes. C'est voulu.
- Un catalogue gardé hors ligne avant cette décision n'a pas de thèmes : il est complété par une liste vide à la lecture.
