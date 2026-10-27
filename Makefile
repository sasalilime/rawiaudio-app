# Mise en ligne de l'API de Rawi sur le VPS (ADR-0011).
# Première installation du serveur : ops/runbooks/installer-sur-le-vps.md. Ensuite, à chaque version : make deploy-api
# Surcharge possible : make deploy-api VPS=ubuntu@94.23.107.23 (vps = alias de ~/.ssh/config, connexion partagée).
VPS ?= vps

.PHONY: deploy-api

# Ce qui est déployé est toujours commité, fichiers non suivis compris (une migration non commitée serait
# embarquée dans le binaire, puis appliquée à la base de production). Binaire et script appartiennent à root, lisibles par rawi :
# l'API ne peut pas réécrire son propre code.
deploy-api:
	@test -z "$$(git status --porcelain -- apps/api ops Makefile)" || { echo "apps/api, ops ou Makefile modifiés ou non suivis : commiter avant de déployer"; exit 1; }
	cd apps/api && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o ../../build/rawi-api .
	rsync -az --rsync-path="sudo rsync" --chown=root:rawi --chmod=F750 build/rawi-api ops/backup.sh $(VPS):/var/www/rawi/
	rsync -az --rsync-path="sudo rsync" --chown=root:root --chmod=F644 ops/systemd/rawi-api.service ops/systemd/rawi-backup.service ops/systemd/rawi-backup.timer $(VPS):/etc/systemd/system/
	rsync -az --rsync-path="sudo rsync" --chown=root:root --chmod=F644 ops/rawi.caddy $(VPS):/etc/caddy/sites/
	ssh $(VPS) 'sudo systemctl daemon-reload && sudo systemctl enable rawi-api rawi-backup.timer >/dev/null 2>&1 && sudo systemctl restart rawi-api && sudo systemctl start rawi-backup.timer && sudo systemctl reload caddy && systemctl is-active rawi-api'
