#!/usr/bin/env bash
# Sauvegarde de la base de Rawi (pg_dump, format custom), avec rotation. Procédure : ops/runbooks/sauvegardes.md.
# Lancé chaque nuit par rawi-backup.timer, sous l'utilisateur rawi : Postgres le reconnaît sans mot de passe.
# À la main sur le VPS : sudo systemctl start rawi-backup.service
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/rawi}"
KEEP_DAYS="${KEEP_DAYS:-14}"

umask 077 # les sauvegardes contiendront les données des familles : lisibles par leur seul propriétaire
mkdir -p "$BACKUP_DIR"
file="$BACKUP_DIR/rawi-$(date -u +%Y-%m-%dT%H%M%SZ).dump"
trap 'rm -f "$file.partial"' EXIT # un dump interrompu ne doit pas rester sur le disque

# D'abord dans un fichier temporaire : un dump interrompu ne doit jamais passer pour une sauvegarde valide.
pg_dump --dbname=rawi --format=custom --file="$file.partial"
mv "$file.partial" "$file"

find "$BACKUP_DIR" -name 'rawi-*.dump' -mtime +"$KEEP_DAYS" -delete
echo "sauvegarde faite : $file ($(du -h "$file" | cut -f1))"
