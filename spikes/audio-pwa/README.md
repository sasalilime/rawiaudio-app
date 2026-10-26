# Prototype audio PWA (jetable)

Action 1 de l'ADR-0001 : la lecture audio d'une PWA tient-elle sur iPhone ?
Le code ne sera pas repris dans `apps/web`. Seules les conclusions comptent : elles iront dans un ADR.

## Ce que le prototype reproduit de la future appli
- Un seul élément `<audio>`, et les actions de l'écran verrouillé (Media Session) enregistrées dans l'événement `playing`.
- Une URL « signée » qui change à chaque lecture (`?sig=…`), alors que le téléchargement est rangé sous l'identifiant de l'épisode.
- La lecture hors ligne servie par le service worker, en réponses 206 (plages d'octets).
- La reprise de la position après fermeture.

Non reproduit : R2 (l'audio vient du même domaine, donc pas de CORS), l'API, la connexion.

## Préparer les médias (hors git)
```bash
cd ~/dev/rawiaudio-app/spikes/audio-pwa
mkdir -p public/media
cp ~/Documents/rawi/gens_caverne_ep_1/ep_1_gens_caverne.mp3 public/media/ep1.mp3
cp ~/Documents/rawi/gens_caverne_ep_1/miniature_final.jpg public/media/ep1.jpg
```

## Déployer
Le service worker exige HTTPS : on publie le dossier `public/` sur Cloudflare, sous une adresse `workers.dev` à part.
Les fichiers statiques des Workers ignorent l'en-tête `Range`, alors que Safari en a besoin pour lire l'audio. `worker.js` répond donc aux plages pour `/media/`, comme le fera R2 en production.
```bash
cd ~/dev/rawiaudio-app/spikes/audio-pwa
npx wrangler@4.142.0 deploy
```
La configuration est dans `wrangler.jsonc`. L'adresse s'affiche à la fin : https://rawi-spike-audio.soft-wind-f3cc.workers.dev.
Après une modification : changer `VERSION` dans `app.js`, puis relancer la commande `deploy`.
À la fin des tests : `npx wrangler@4.142.0 delete --name rawi-spike-audio`.

## Protocole
Noter le modèle de l'iPhone et la version d'iOS. Sauf mention contraire, chaque test se fait dans l'appli installée.
Après chaque test, « Copier le journal » et le coller dans une note : il date chaque événement.

| # | Test | Comment | Attendu | Résultat |
|---|---|---|---|---|
| 1 | Installation | Safari → l'adresse → Partager → « Sur l'écran d'accueil », puis ouvrir depuis l'icône | icône Rawi, plein écran, en-tête « appli installée » | |
| 2 | Streaming, écran verrouillé | « Lire en streaming », verrouiller 5 min | le son continue | |
| 3 | Écran verrouillé | regarder l'écran verrouillé pendant la lecture | titre, miniature, boutons −15 s / +15 s qui fonctionnent | |
| 4 | Autre appli | ouvrir une appli muette (Notes) pendant 5 min | le son continue | |
| 5 | Interruption | se faire appeler (ou alarme, ou Siri), puis raccrocher | la lecture repart depuis l'écran verrouillé | |
| 6 | Écouteurs | retirer les AirPods, puis play/pause depuis les écouteurs | pause au retrait, commandes qui répondent | |
| 7 | Téléchargement | « Télécharger » | « Épisode téléchargé » ; noter « Persistant » | |
| 8 | Hors ligne | mode Avion (Wi-Fi coupé aussi), fermer l'appli (balayer vers le haut), la rouvrir, « Lire hors ligne », avancer au milieu | l'appli s'ouvre, le son démarre, le saut fonctionne | |
| 9 | Hors ligne, écran verrouillé | mode Avion, « Lire hors ligne », verrouiller jusqu'à la fin (6 min 30) | le son va jusqu'au bout | |
| 10 | Reprise | pause vers 3 min, fermer l'appli, la rouvrir, relire | journal : « reprise à 3:xx » | |
| 11 | Durée du téléchargement | rouvrir l'appli 2 ou 3 jours plus tard | toujours « Épisode téléchargé » | |
| 12 | Safari sans installer | refaire les tests 2, 3 et 8 dans Safari | à comparer : toutes les familles n'installeront pas l'appli | |

## Conclusions
Voir [ADR-0002](../../docs/adr/0002-lecture-audio-pwa.md) : testé le 26 octobre 2026 sur iPhone 16e, iOS 27.0.1.
