# ADR-0011 : Mise en ligne de l'API sur le socle du VPS

**Statut :** Accepté
**Date :** 27 octobre 2026
**Décideur :** Salim
**Remplace en partie :** ADR-0005 (la stack Docker Compose de production et son déploiement)

## Contexte
- L'ADR-0005 prévoyait une stack Docker Compose (API + Postgres) par site. Le socle du VPS a été installé ensuite, le 26 octobre 2026, avec une autre convention, appliquée par alfurqan.fr :
  - pas de Docker ;
  - pour chaque site : un utilisateur système, un service systemd plafonné à 512 Mo, un fichier Caddy dans `/etc/caddy/sites/`, des secrets dans `/etc/<site>.env` (root, 600) ;
  - un `make deploy` depuis le poste : compilation locale, `rsync`, redémarrage.
- Docker ouvre les ports qu'il publie en passant par-dessus ufw, le pare-feu du VPS.
- Le VPS propose PostgreSQL 18 (Ubuntu 26.04), la même version majeure que le dev.

## Décision
- **L'API suit la convention du VPS** :
  - utilisateur système `rawi` ; binaire dans `/var/www/rawi`, à root et lisible par `rawi`, pour que l'API ne puisse pas réécrire son propre code ;
  - service `rawi-api` (`ops/systemd/rawi-api.service`) : `127.0.0.1:8100` seulement, durci comme alfurqan (système de fichiers en lecture seule, aucun privilège) ;
  - Caddy relaie `api.rawiaudio.com` (`ops/rawi.caddy`) et obtient le certificat ; DNS en « DNS only » chez Cloudflare ;
  - secrets (token R2 de production, origine CORS) dans `/etc/rawi.env` ;
  - `make deploy-api` refuse de partir si `apps/api` ou `ops/` ont des changements non commités : la production correspond toujours à un commit.
- **Postgres installé sur le VPS** (paquet d'Ubuntu), pas dans Docker :
  - ses correctifs de sécurité arrivent avec les mises à jour automatiques du socle ;
  - l'API s'y connecte par le socket local sous l'utilisateur `rawi`, reconnu par le système (authentification « peer ») : aucun mot de passe de base à garder ;
  - il n'écoute que sur la machine ; il pourra servir d'autres sites du VPS, chacun avec son rôle et sa base ;
  - base `rawi` en tri français (ICU `fr-FR`).
- **Sauvegardes** : même principe que l'ADR-0005 (`pg_dump` chaque nuit, 14 jours, restauration d'essai chaque mois), sous l'utilisateur `rawi`, sans Docker (`ops/backup.sh`, `ops/runbooks/sauvegardes.md`).
- **Inchangé** : la PWA sur Cloudflare (`app.rawiaudio.com`), le CORS, la publication des épisodes à la main, désormais par SSH depuis le poste.
- Docker reste l'outil du développement local (`apps/api/compose.yaml`).

## Conséquences
- `ops/compose.yaml` et `ops/.env.example` disparaissent ; `ops/rawi.env.example` décrit `/etc/rawi.env`.
- L'API accepte une variable `HOST` (adresse d'écoute) : `127.0.0.1` sur le VPS, vide en dev.
- Procédure de première installation : `ops/runbooks/installer-sur-le-vps.md`.
- Vérifié en local le 27 octobre 2026 : compilation Linux statique (11 Mo), lecture de l'adresse par socket par pgx, script de sauvegarde (dump, droits, rotation, restauration) contre Postgres 18. Pas encore exécuté sur le VPS.
- Une mise à jour de Postgres par Ubuntu le redémarre : l'API perd ses connexions un instant, et le pool de pgx les rouvre.

## Actions
1. [ ] Cloudflare : DNS `api.rawiaudio.com` (« DNS only »), token R2 de production.
2. [ ] VPS : Postgres, utilisateur, dossiers, `/etc/rawi.env` (runbook, étapes 2 et 3).
3. [ ] `make deploy-api`, puis vérifications et première restauration d'essai.
4. [ ] Épisodes, bucket des illustrations, puis la PWA (reprend les actions 5 et 6 de l'ADR-0005).
