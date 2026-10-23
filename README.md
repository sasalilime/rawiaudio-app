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

## Repos liés

- `rawiaudio-site` : vitrine rawiaudio.com.
- `rawiaudio-studio` : production des épisodes.

Les règles de travail sont dans [`CLAUDE.md`](CLAUDE.md), les décisions dans [`docs/adr/`](docs/adr/).
