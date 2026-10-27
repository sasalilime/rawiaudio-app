# ADR-0005 : Mise en ligne de l'API et de la PWA

**Statut :** Remplacé en partie par l'ADR-0011 (27 octobre 2026) : plus de Docker en production, l'API et Postgres suivent la convention du socle du VPS. Le reste (Caddy, DNS, PWA, CORS, principe des sauvegardes, publication) tient toujours.
**Date :** 26 octobre 2026
**Décideur :** Salim

## Contexte
- L'API (Go + Postgres) va sur le VPS OVH, et la PWA sur Cloudflare (ADR-0001).
- Le VPS héberge plusieurs sites. Son socle (pare-feu, Docker, Caddy, accès SSH) est partagé et n'est pas dans ce repo. Au 26 octobre 2026, rien n'y est installé.
- Il n'existe pas encore d'import des épisodes depuis `rawiaudio-studio`.

## Décision
- **Caddy en frontal**, installé sur le système avec le paquet officiel : un bloc par domaine, HTTPS automatique. Chaque appli expose son port sur `127.0.0.1` seulement. Rawi : `127.0.0.1:8100`.
- **Stack Rawi** (`ops/compose.yaml`, projet `rawi`) :
  - l'API et Postgres, avec un réseau propre à la stack ;
  - des limites de mémoire (API 128 Mo, base 512 Mo) et la rotation des journaux ;
  - l'API en lecture seule, sans privilège ;
  - la base sans aucun port publié.
- **Déploiement** : le repo cloné dans `/srv/rawiaudio-app`, puis `git pull` et `docker compose up -d --build`. Pas de registre d'images.
- **Secrets** : `ops/.env` sur le VPS uniquement (`chmod 600`), avec un token R2 de production distinct de celui du dev.
- **DNS** : `api.rawiaudio.com` pointe vers le VPS, en enregistrement Cloudflare « DNS only » (Caddy obtient ses certificats).
- **PWA** : Cloudflare Workers en fichiers statiques sur `app.rawiaudio.com` (`apps/web/wrangler.jsonc`), toutes les adresses renvoyant l'appli. `npm run build:prod` y intègre l'adresse de l'API.
- **CORS** : l'API n'autorise que `https://app.rawiaudio.com` (variable `CORS_ALLOWED_ORIGIN`).
- **Sauvegardes** (`ops/runbooks/sauvegardes.md`) :
  - un `pg_dump` chaque nuit par un timer systemd, conservé 14 jours ;
  - une restauration d'essai chaque mois.
- **Épisodes** : publiés à la main (`ops/runbooks/publier-un-episode.md`), sources et résumé recopiés des fiches du studio avant toute publication.

## Conséquences
- La stack de production a été lancée en local le 26 octobre 2026, avec : santé, CORS, durcissement, sauvegarde, restauration et rotation vérifiés.
- Tant que le socle du VPS n'est pas installé, rien n'est en ligne. Le test sur iPhone de la PWA l'attend.
- Une copie des sauvegardes hors du VPS reste à décider.
- Le premier déploiement de la PWA crée l'enregistrement DNS de `app.rawiaudio.com`. Il ne doit se faire qu'une fois l'API en ligne, puisque la PWA l'appelle.

## Actions
1. [ ] Socle du VPS (hors de ce repo) : accès SSH, snapshot, pare-feu, Docker, Caddy.
2. [ ] Token R2 de production, puis `ops/.env` sur le VPS.
3. [ ] DNS `api.rawiaudio.com`, bloc Caddy, premier `docker compose up`.
4. [ ] Timer de sauvegarde et première restauration d'essai.
5. [ ] Épisodes 1 à 4 : audio de l'épisode 4, sources et résumés depuis les fiches du studio, publication.
6. [ ] Déploiement de la PWA sur `app.rawiaudio.com`, puis test complet sur iPhone.
