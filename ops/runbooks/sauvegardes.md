# Sauvegardes de la base

La base de Rawi est sauvegardée chaque nuit par `ops/backup.sh` :
- `pg_dump` au format custom, dans `/var/backups/rawi/` ;
- fichiers lisibles par leur seul propriétaire ;
- conservés 14 jours.

Le backup automatique d'OVH copie aussi le disque du VPS chaque jour. Il ne remplace pas ces dumps : une restauration OVH ramène tout le VPS en arrière, tous les sites compris.

Toutes les commandes se lancent sur le VPS, depuis `/srv/rawiaudio-app`.

## Installer la sauvegarde de chaque nuit (une fois)
```bash
sudo cp ops/systemd/rawi-backup.service ops/systemd/rawi-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now rawi-backup.timer
systemctl list-timers rawi-backup.timer    # affiche la prochaine exécution
```
Si le repo n'est pas dans `/srv/rawiaudio-app`, corriger d'abord le chemin `ExecStart` du fichier `.service`.

## Lancer une sauvegarde à la main
Avant une migration risquée, par exemple :
```bash
sudo systemctl start rawi-backup.service
journalctl -u rawi-backup.service -n 5    # doit finir par « sauvegarde faite : … »
```

## Vérifier qu'une sauvegarde se restaure (une fois par mois)
Une sauvegarde jamais restaurée n'est pas une sauvegarde. On la restaure dans une base à part, sans toucher à la vraie :
```bash
cd ops
dump=$(ls -t /var/backups/rawi/rawi-*.dump | head -1)
docker compose exec -T db createdb -U rawi rawi_restore_test
sudo cat "$dump" | docker compose exec -T db pg_restore -U rawi -d rawi_restore_test --no-owner
docker compose exec -T db psql -U rawi -d rawi_restore_test -c "SELECT count(*) FROM episodes"
docker compose exec -T db dropdb -U rawi rawi_restore_test
```
Le nombre d'épisodes doit être celui de la production.

## Restaurer la production (incident)
1. Couper l'API pour que plus rien n'écrive : `docker compose stop api` (depuis `ops/`).
2. Faire une sauvegarde de l'état actuel, même abîmé : `./backup.sh`.
3. Restaurer le dump choisi par-dessus la base :
   ```bash
   sudo cat /var/backups/rawi/rawi-<date>.dump | docker compose exec -T db pg_restore -U rawi -d rawi --clean --if-exists --no-owner
   ```
4. Relancer l'API : `docker compose start api`, puis `curl -s https://api.rawiaudio.com/health`.
5. Noter l'incident (date, cause, données perdues) dans ce dossier `runbooks/`.

## À décider plus tard
Une copie des dumps hors du VPS, par exemple dans un bucket R2 à part, pour survivre à la perte du VPS ou du compte OVH.
