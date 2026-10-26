# ADR-0002 : Lecture audio dans la PWA

**Statut :** Accepté (sous réserve du test de durée du téléchargement, prévu le 29 octobre 2026)
**Date :** 26 octobre 2026
**Décideur :** Salim

## Contexte
- L'ADR-0001 mise sur une PWA d'abord. Le risque principal est iOS : lecture écran verrouillé, commandes de l'écran verrouillé, hors ligne.
- Action 1 de l'ADR-0001 : un prototype jetable, `spikes/audio-pwa/`, qui reproduit les choix prévus pour `apps/web` :
  - un seul `<audio>` ;
  - Media Session enregistrée dans `playing` ;
  - une URL « signée » qui change à chaque lecture ;
  - le téléchargement rangé sous l'identifiant de l'épisode ;
  - la lecture hors ligne servie par le service worker en réponses 206 ;
  - la reprise de la position.
- Testé le 26 octobre 2026 sur un **iPhone 16e, iOS 27.0.1**, avec l'épisode 1 (6 Mo, 128 kbit/s), hébergé sur Cloudflare (`workers.dev`).

## Résultats
| Point | Résultat | Source |
|---|---|---|
| Streaming dans Safari | fonctionne ; démarrage lent (5 à 15 s) | journal |
| Téléchargement dans Safari (Cache API) | fonctionne ; stockage persistant refusé (`false`) | journal |
| Installation sur l'écran d'accueil | fonctionne | Salim |
| Son qui continue iPhone verrouillé | fonctionne | Salim |
| Commandes de l'écran verrouillé (pause, −15 s / +15 s) | fonctionnent | Salim |
| Lecture hors ligne en mode Avion, appli installée | fonctionne | Salim |
| Reprise de la position après fermeture | fonctionne | Salim |
| Téléchargement encore présent 2 ou 3 jours après | **à vérifier le 29 octobre 2026** | — |
| Écran verrouillé et hors ligne dans Safari sans installer | non testés | — |

Constats en cours de route :
- **Les fichiers statiques des Workers ignorent l'en-tête `Range`.** Safari ne peut donc pas lire l'audio servi ainsi. Le prototype passe par un petit Worker qui répond en 206. R2 gère les plages lui-même, la production n'est donc pas concernée.
- **Sur iOS, l'appli installée et Safari ont chacun leur stockage.** Un épisode téléchargé dans Safari n'existe pas dans l'appli installée.
- **L'état « téléchargé » n'était pas assez visible** dans le prototype : Salim ne savait plus s'il avait téléchargé.
- **Le démarrage lent du streaming n'est pas expliqué.** Deux causes sont possibles : le réseau de ce jour-là (le téléchargement a mesuré environ 3 Mbit/s), ou le Worker du prototype, qui relit tout le fichier à chaque plage.

## Décision
- **La PWA reste le premier client sur iPhone.** L'ADR-0001 est confirmé sur ce point.
- Les règles audio du `CLAUDE.md` sont validées telles quelles :
  - un seul `<audio>` ;
  - Media Session dans `playing` ;
  - le cache par identifiant d'épisode ;
  - les réponses 206 depuis le cache.
- Le parcours de l'appli pousse à installer l'appli **avant** de télécharger, et l'état « téléchargé » se voit sur chaque épisode.

## Conséquences
- La tranche « URLs signées R2 » vérifie que R2 répond en 206 aux plages, et que le CORS du bucket autorise le téléchargement par `fetch` depuis `app.rawiaudio.com`.
- On mesure le délai avant le premier son avec R2. S'il reste au-dessus de 2 à 3 secondes, on cherche la cause avant le lecteur de la PWA.
- iOS change chaque année en septembre. On repasse la version courte du protocole (`spikes/audio-pwa/README.md`) à chaque version majeure.

## Actions
1. [ ] Le 29 octobre 2026 : rouvrir l'appli installée et vérifier que l'épisode est toujours « téléchargé ».
2. [ ] Ensuite, supprimer le déploiement du prototype : `npx wrangler@4.142.0 delete --name rawi-spike-audio`.
