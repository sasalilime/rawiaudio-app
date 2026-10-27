# rawiaudio-app

Le produit Rawi Audio : histoires islamiques audio pour les familles.
PWA, API, contrat OpenAPI et stack ops de Rawi.

## Structure

| Dossier | Rôle |
|---|---|
| `apps/web/` | PWA React + Vite + TypeScript (app.rawiaudio.com, Cloudflare) |
| `apps/api/` | API Go (api.rawiaudio.com, Docker Compose sur le VPS) |
| `apps/mobile/` | app Expo (React Native), iOS et Android |
| `packages/shared/` | code TypeScript commun à la PWA et à l'app mobile |
| `contracts/` | `openapi.yaml`, contrat entre l'API et la PWA |
| `ops/` | stack Docker Compose de Rawi, sauvegardes, `runbooks/` |
| `spikes/` | prototypes jetables |
| `docs/adr/` | décisions d'architecture |

## API (`apps/api`)

### Démarrer en local
```bash
cd apps/api
cp .env.example .env    # puis changer le mot de passe sur ses trois lignes, et remplir les variables R2
```
- Tout dans Docker : `docker compose up -d --build`, puis `curl -i localhost:8080/health`.
- Ou l'API avec `go run`, la base seule dans Docker :
  ```bash
  docker compose up -d --wait db
  set -a; . ./.env; set +a
  go run .
  ```

Les migrations de `migrations/` s'appliquent au démarrage de l'API.

Les e-mails du dev (connexion, ADR-0012) partent dans Mailpit, un faux serveur SMTP : `docker compose up -d mailpit`, puis http://127.0.0.1:8026 pour les lire. Rien ne part vraiment.
Données de développement (après un premier démarrage, rejouable) :
```bash
docker compose exec -T db psql -U rawi -d rawi -v ON_ERROR_STOP=1 < dev/seed.sql
```

### Avant chaque commit
```bash
cd apps/api
set -a; . ./.env; set +a    # TEST_DATABASE_URL : sans elle, les tests d'intégration sont sautés
go vet ./...
go test -race -count=1 ./...
go run golang.org/x/vuln/cmd/govulncheck@v1.9.0 ./...
```

### Mettre à jour une image Docker
Les images sont épinglées par digest d'index (`tag@sha256:…`) : elles ne reçoivent aucun correctif toutes seules.
1. Lire le digest du nouveau tag, par exemple :
   ```bash
   docker buildx imagetools inspect golang:1.26.10-alpine3.24 | grep -m1 Digest
   ```
2. Remplacer le tag et le digest dans `apps/api/Dockerfile` (images `golang` et `distroless`) ou `apps/api/compose.yaml` (image `postgres`).
3. Changement de version de Go : changer aussi la ligne `go` de `apps/api/go.mod`, les deux doivent concorder.

## PWA (`apps/web`)

### Démarrer en local
L'API doit tourner sur le port 8080 (voir plus haut) : en dev, Vite lui relaie les appels à `/api`.
```bash
npm ci --ignore-scripts    # à la racine : PWA, code partagé et app mobile
cd apps/web
npm run dev    # http://localhost:5180
```
Le service worker (hors ligne) ne tourne que dans l'appli construite, à la même adresse :
```bash
npm run build && npx vite preview    # http://localhost:5180
```
En revenant à `npm run dev`, l'appli retire elle-même ce service worker.

### Avant chaque commit
```bash
npm run typecheck    # à la racine : tous les paquets TypeScript
npm test
npm run build -w apps/web
```

## App mobile (`apps/mobile`)

### Essayer sur un téléphone
- Sur le téléphone : l'appli Expo Go (App Store ou Play Store).
- Le téléphone et le poste sur le même Wi-Fi, l'API lancée sur le poste (voir plus haut).
```bash
cd apps/mobile
EXPO_PUBLIC_API_URL="http://$(hostname -I | awk '{print $1}'):8080" npx expo start
```
Scanner le QR code affiché : avec l'appareil photo sur iPhone, depuis Expo Go sur Android.

Les polices et les images de l'app sont dans `apps/mobile/assets/` ; la fabrication des polices est décrite dans `assets/fonts/README.md`.

### Avant chaque commit
En plus des vérifications de la PWA :
```bash
npm run export -w apps/mobile    # Metro empaquette l'app pour Android et iOS
```

## Ajouter ou mettre à jour une dépendance npm
`--before` limite toute l'arborescence, dépendances indirectes comprises, aux versions de plus de 15 jours. Le réglage `min-release-age` de `~/.npmrc` n'est pas appliqué par npm 10.
```bash
npm install --ignore-scripts --before="$(date -u -d '15 days ago' +%FT%TZ)"
```

## Production (`ops/`)

Décisions : [ADR-0005](docs/adr/0005-mise-en-ligne.md), [ADR-0011](docs/adr/0011-mise-en-ligne-sur-le-socle-du-vps.md). Procédures : [`ops/runbooks/`](ops/runbooks/), dont la première installation (`installer-sur-le-vps.md`).
- L'API tourne sur le VPS en service systemd (`ops/systemd/rawi-api.service`), derrière Caddy (`ops/rawi.caddy`), avec Postgres installé sur le VPS. Pas de Docker en production.
- Mettre en ligne une nouvelle version de l'API, tout étant commité : `make deploy-api`, à la racine.
- `ops/backup.sh` et `ops/systemd/` : sauvegarde de la base chaque nuit.
- `ops/episodes/` : SQL de saisie des épisodes, en attendant l'import depuis le studio.

## Repos liés

- `rawiaudio-site` : vitrine rawiaudio.com.
- `rawiaudio-studio` : production des épisodes.

Les règles de travail sont dans [`CLAUDE.md`](CLAUDE.md), les décisions dans [`docs/adr/`](docs/adr/).
