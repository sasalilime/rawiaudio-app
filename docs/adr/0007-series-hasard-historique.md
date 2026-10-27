# ADR-0007 : Séries, lecture enchaînée et histoire au hasard

**Statut :** Accepté
**Date :** 26 octobre 2026
**Décideur :** Salim

## Contexte
- Objectif du studio : des épisodes d'environ 5 minutes. Une histoire longue sera donc découpée en plusieurs parties.
- Si chaque partie était une ligne de l'accueil, le catalogue serait vite noyé.
- Salim veut un bouton qui lance une histoire au hasard, en privilégiant celles qui n'ont pas encore été entendues.

## Décision
- **Série = une histoire en plusieurs parties**, écoutées dans l'ordre.
  - Chaque épisode d'une série porte son numéro de partie (`episodes.series_part`), unique dans la série.
  - La base refuse une série sans partie, une partie sans série, et une série d'une autre langue.
  - L'API renvoie `series: { id, title, part }`.
- **L'ancienne « série » Al-Kahf est supprimée** : c'était un recueil d'histoires indépendantes. Les épisodes 1 et 2 sont rangés dans « Histoires du Coran ». Une sous-catégorie (« Sourate Al-Kahf ») pourra venir plus tard, sous un thème.
- **À l'accueil**, une série est une seule entrée dans ses thèmes : son titre, son nombre de parties, sa durée totale et sa progression. Une page par série liste les parties dans l'ordre.
- **Lecture enchaînée** : à la fin d'une partie, la suivante démarre seule, jusqu'à la fin de la série. Jamais d'une histoire à une autre. La partie suivante est préparée dès le début de la précédente.
- **Historique d'écoute** :
  - gardé sur l'appareil ;
  - un épisode compte comme **entendu** au-delà de 95 % de sa durée ;
  - il ne sert qu'au tirage au hasard et aux marques « écouté » ;
  - la position de reprise est gardée à part : « Reprendre à … » reste proposé tant qu'on n'est pas allé au bout.
- **Histoire au hasard** :
  - un bouton à l'accueil, qui lance directement la lecture ;
  - le tirage se fait parmi les histoires pas encore entendues : un épisode indépendant, ou la prochaine partie non entendue d'une série ;
  - si tout a été entendu, le tirage se fait dans tout le catalogue, une série toujours par sa partie 1 ;
  - hors ligne, seulement parmi les épisodes téléchargés ;
  - le tirage est fait et son URL préparée à l'avance : le clic lance le son sans attente (iOS).

## Conséquences
- **Mise à jour du 27 octobre 2026 (ADR-0012)** : connecté, l'historique suit le compte sur tous les appareils de la famille.
  - Un épisode entendu le reste : deux appareils se fusionnent par simple union (`POST /account/history`, table `heard_episodes`), sans conflit possible.
  - L'appareil envoie tout ce qu'il a entendu et garde l'union renvoyée : à la connexion, au démarrage et à chaque épisode entendu. Une synchro manquée hors ligne est rattrapée par la suivante.
  - Un épisode inconnu ou pas encore publié est ignoré. Supprimer le compte supprime son historique ; celui de l'appareil reste.
  - La position de reprise, elle, reste sur l'appareil.
- La PWA calcule elle-même les séries, la partie suivante et le tirage, à partir de la liste du catalogue. L'API n'a pas de route `/series`.
- L'enchaînement lance `play()` à la fin d'une partie, sans nouveau geste de l'utilisateur. iOS l'accepte normalement sur le même élément `<audio>` : **à vérifier sur iPhone**.
- L'historique est perdu en changeant d'appareil. Il sera synchronisé avec la tranche « connexion ».
