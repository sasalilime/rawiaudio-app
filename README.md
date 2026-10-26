# rawiaudio-app

Le produit Rawi Audio : histoires islamiques audio pour les familles.
PWA, API, contrat OpenAPI et stack ops de Rawi.

## Structure

| Dossier | Rôle |
|---|---|
| `apps/web/` | PWA React + Vite + TypeScript (app.rawiaudio.com, Cloudflare) |
| `apps/api/` | API Go (api.rawiaudio.com, Docker Compose sur le VPS) |
| `apps/mobile/` | plus tard : Expo (React Native) |
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
cd apps/web
npm ci --ignore-scripts
npm run dev    # http://localhost:5180
```
Le service worker (hors ligne) ne tourne que dans l'appli construite, à la même adresse :
```bash
npm run build && npx vite preview    # http://localhost:5180
```
En revenant à `npm run dev`, l'appli retire elle-même ce service worker.

### Avant chaque commit
```bash
cd apps/web
npm run typecheck
npm test
npm run build
```

## Repos liés

- `rawiaudio-site` : vitrine rawiaudio.com.
- `rawiaudio-studio` : production des épisodes.

Les règles de travail sont dans [`CLAUDE.md`](CLAUDE.md), les décisions dans [`docs/adr/`](docs/adr/).
