#!/usr/bin/env bash
# Sauvegarde de la base de Rawi (pg_dump, format custom), avec rotation. Procédure : ops/runbooks/sauvegardes.md.
# Lancé chaque nuit sur le VPS ; à la main : ./backup.sh
set -euo pipefail
cd "$(dirname "$0")" # docker compose lit compose.yaml et .env dans ce dossier

BACKUP_DIR="${BACKUP_DIR:-/var/backups/rawi}"
KEEP_DAYS="${KEEP_DAYS:-14}"

umask 077 # les sauvegardes contiennent les données des familles : lisibles par leur seul propriétaire
mkdir -p "$BACKUP_DIR"
file="$BACKUP_DIR/rawi-$(date -u +%Y-%m-%dT%H%M%SZ).dump"

# D'abord dans un fichier temporaire : un dump interrompu ne doit jamais passer pour une sauvegarde valide.
docker compose exec -T db pg_dump --username=rawi --dbname=rawi --format=custom >"$file.partial"
mv "$file.partial" "$file"

find "$BACKUP_DIR" -name 'rawi-*.dump' -mtime +"$KEEP_DAYS" -delete
echo "sauvegarde faite : $file ($(du -h "$file" | cut -f1))"
