# Sauvegardes de la base

La base de Rawi est sauvegardée chaque nuit, vers 3 h 15, par `ops/backup.sh` (timer systemd `rawi-backup.timer`, installé par `make deploy-api`) :
- `pg_dump` au format custom, dans `/var/backups/rawi/` ;
- fichiers lisibles par l'utilisateur `rawi` seul ;
- conservés 14 jours.

Le backup automatique d'OVH copie aussi le disque du VPS chaque jour. Il ne remplace pas ces dumps : une restauration OVH ramène tout le VPS en arrière, tous les sites compris.

Les commandes se lancent sur le VPS (`ssh vps`).

## Vérifier que la sauvegarde tourne
```bash
systemctl list-timers rawi-backup.timer    # prochaine et dernière exécution
journalctl -u rawi-backup.service -n 5     # doit finir par « sauvegarde faite : … »
sudo ls -lt /var/backups/rawi | head -3
```

## Lancer une sauvegarde à la main
Avant une migration risquée, par exemple :
```bash
sudo systemctl start rawi-backup.service
journalctl -u rawi-backup.service -n 5
```

## Vérifier qu'une sauvegarde se restaure (une fois par mois)
Une sauvegarde jamais restaurée n'est pas une sauvegarde. On la restaure dans une base à part, sans toucher à la vraie :
```bash
dump=$(sudo ls -t /var/backups/rawi | head -1)
sudo -u postgres createdb --owner=rawi rawi_restore_test
sudo cat "/var/backups/rawi/$dump" | sudo -u rawi pg_restore --dbname=rawi_restore_test --no-owner
sudo -u rawi psql -d rawi_restore_test -c "SELECT count(*) FROM episodes"
sudo -u postgres dropdb rawi_restore_test
```
- `sudo cat … |` : le dump n'est lisible que par `rawi` et root, `pg_restore` le reçoit donc par un tube.
- Le nombre d'épisodes doit être celui de la production.

## Restaurer la production (incident)
1. Couper l'API pour que plus rien n'écrive : `sudo systemctl stop rawi-api`.
2. Faire une sauvegarde de l'état actuel, même abîmé : `sudo systemctl start rawi-backup.service`.
3. Restaurer le dump choisi par-dessus la base :
   ```bash
   sudo cat /var/backups/rawi/rawi-<date>.dump | sudo -u rawi pg_restore --dbname=rawi --clean --if-exists --no-owner
   ```
4. Relancer l'API : `sudo systemctl start rawi-api`, puis `curl -s https://api.rawiaudio.com/health`.
5. Noter l'incident (date, cause, données perdues) dans ce dossier `runbooks/`.

## À décider plus tard
Une copie des dumps hors du VPS, par exemple dans un bucket R2 à part, pour survivre à la perte du VPS ou du compte OVH.
