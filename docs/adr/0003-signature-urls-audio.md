# ADR-0003 : Signature des URLs audio

**Statut :** Accepté
**Date :** 26 octobre 2026
**Décideur :** Salim

## Contexte
- L'audio est dans Cloudflare R2, bucket privé, juridiction EU (ADR-0001). L'API vérifie l'accès puis renvoie une URL temporaire ; l'audio ne passe jamais par le VPS.
- D'après la doc de R2 :
  - les URLs pré-signées utilisent la signature d'AWS (SigV4), avec la région `auto` ;
  - elles ne fonctionnent que sur le domaine S3 de R2 (`<compte>.eu.r2.cloudflarestorage.com` en juridiction EU), jamais sur un domaine personnalisé ;
  - elles durent de 1 seconde à 7 jours.
- Règle des dépendances : rien de plus que nécessaire. `pgx` est la seule bibliothèque de l'API.

## Options considérées
- **A. SDK S3 d'AWS (`aws-sdk-go-v2/service/s3`).**
  - Pour : la signature est maintenue par AWS.
  - Contre : une dizaine de modules pour une seule fonction.
- **B. SigV4 écrite à la main avec la stdlib (retenue).**
  - Pour : une soixantaine de lignes de HMAC-SHA256, aucune dépendance. Testée contre l'exemple officiel d'AWS, dont la signature attendue est publiée.
  - Contre : du code de signature à maintenir. Une erreur produit un 403, jamais un accès ouvert, puisque c'est R2 qui vérifie.
- **C. Un Worker devant R2, avec un token HMAC maison.**
  - Pour : l'audio pourrait être servi sur un domaine `rawiaudio.com`.
  - Contre : un service de plus à déployer et à surveiller.

## Décision
- Signature SigV4 maison dans `apps/api/internal/r2`.
  - Adressage par chemin : `/<bucket>/<clé>`.
  - Seul l'en-tête `host` est signé : le navigateur ajoute ses `Range` librement.
- `GET /episodes/{id}/audio` renvoie `{ "url", "expiresAt" }`, avec une URL valable **1 heure**.
- Clé dans le bucket : `<langue>/<numéro sur 3 chiffres>-<slug>/audio-128.mp3`. Exemple : `fr/001-les-gens-de-la-caverne/audio-128.mp3`.
- Bucket `rawi-audio`, juridiction EU.
  - Un seul bucket pour le dev et la prod pour l'instant.
  - Token R2 « lecture seule », limité à ce bucket. La prod aura son propre token.

## Conséquences
- L'audio est servi sur le domaine S3 de R2 et non sur `rawiaudio.com`. Les règles de cache de Cloudflare sur notre domaine ne s'y appliquent pas.
- Une URL peut expirer pendant une longue pause. La PWA doit alors redemander une URL et reprendre à la même position (tranche 5).
- Changer le slug d'un épisode oblige à déplacer son fichier dans le bucket.
- La clé secrète R2 ne quitte jamais l'API et n'apparaît jamais dans les logs.
- À revoir si la latence de R2 pose problème (ADR-0002) : l'option C.

## Vérification (26 octobre 2026)
- La signature reproduit au caractère près l'exemple officiel d'AWS (« Authenticating Requests: Using Query Parameters »).
- Le bucket `rawi-audio` existe en juridiction EU, avec l'épisode 1 à `fr/001-les-gens-de-la-caverne/audio-128.mp3` ; sa relecture donne une empreinte identique au fichier d'origine.
- Avec un token « Object Read only » limité au bucket, une URL renvoyée par `GET /episodes/{id}/audio` lit le fichier :
  - le fichier entier renvoie 200, une plage renvoie 206 ;
  - une signature modifiée ou une URL expirée renvoie 403 ; un fichier absent, 404.
- Le CORS posé par `ops/r2-cors.json` n'autorise que `https://app.rawiaudio.com`.
