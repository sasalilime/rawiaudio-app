# Rawi Audio — instructions pour Claude Code

## Le projet
- Histoires islamiques audio pour les familles (français d'abord, arabe et anglais ensuite).
- Ligne : fidèle, douce, équilibrée. Sources vérifiées sous chaque épisode.
- Modèle : PWA gratuite d'abord, abonnement Stripe quand le catalogue le justifie (30 épisodes et plus).
- Développeur unique : Salim, senior TypeScript, en apprentissage Go. Il relit chaque diff.

## Structure du repo `rawiaudio-app`
```
apps/
  web/       PWA React + Vite + TypeScript strict (app.rawiaudio.com, Cloudflare)
  api/       API Go (api.rawiaudio.com, Docker Compose sur le VPS OVH)
  mobile/    app Expo (React Native), iOS et Android (ADR-0008)
packages/
  shared/    code TypeScript commun à web/ et mobile/ : core, client HTTP, stockages (ADR-0008)
contracts/
  openapi.yaml   contrat de l'API, source de vérité entre api/ et web/
ops/         stack Docker Compose de Rawi (API + Postgres), scripts de sauvegarde, runbooks/
spikes/      prototypes jetables
docs/adr/    décisions d'architecture
```

## Repos liés (séparés, on n'y touche pas depuis ici)
- `rawiaudio-site` : vitrine rawiaudio.com (Hono, Cloudflare Workers).
- `rawiaudio-studio` : production des épisodes (scripts, sources, rendus).
- Le passage d'un épisode de studio vers l'appli (métadonnées + fichiers sur R2) reste à définir dans un ADR.
- Le socle du VPS (Caddy frontal partagé, pare-feu, sauvegardes globales) sert plusieurs sites : il n'est pas dans ce repo.

## API Go (`apps/api`)
- Bibliothèque standard `net/http` (ServeMux, routage natif `GET /episodes/{id}`). Pas de framework.
- Middlewares : fonctions `func(http.Handler) http.Handler`.
- Couches, dans cet ordre :
  - `internal/httpapi` : handlers et middlewares. Décode, valide, appelle un service, encode.
  - `internal/service` : logique métier. N'importe jamais `net/http`.
  - `internal/repository` : SQL uniquement, aucune règle métier.
- Postgres via `pgx` v5. SQL écrit à la main, requêtes paramétrées uniquement.
- Validation : méthode `Validate() error` sur chaque struct de requête, `DisallowUnknownFields()`, `http.MaxBytesReader` sur chaque corps.
- Migrations : fichiers SQL numérotés dans `migrations/`, embarqués avec `embed`, appliqués au démarrage par un petit runner maison (table `schema_migrations`).
- Erreurs : jamais ignorées. `fmt.Errorf("contexte: %w", err)`. Réponses d'erreur JSON uniformes, sans détail interne.
- `context.Context` propagé de la requête jusqu'au SQL.
- Configuration par variables d'environnement. Aucun secret dans le repo ni dans les logs.
- Tests : `testing` de la stdlib. Avant chaque commit : `go vet ./...`, `go test -race ./...`, `govulncheck ./...`.

## Code partagé (`packages/shared`)
- Clean Architecture (ADR-0004), importée par `@rawiaudio/shared/<dossier>/<fichier>.ts` :
  - `core/domain` : entités et règles métier pures ; `core/ports` : interfaces vers l'extérieur ; `core/useCases` : une fonction par action.
  - `http/` : client de l'API et implémentation de `EpisodeRepository` (fetch, présent partout).
  - `storage/` : stockages clé-valeur sur une interface `Storage` (`localStorage` du navigateur, ou celui d'`expo-sqlite`).
  - `ui/` : React sans DOM, commun aux deux clients : contexte des cas d'usage, hooks, textes (`i18n/`), formats. N'importe que `core` et `react`.
  - `core` n'importe rien hors de `core`, ni aucun paquet npm. `src/architecture.test.ts` le vérifie.
- Fabriques de fonctions plutôt que classes (`erasableSyntaxOnly` : Node lance les tests sans compiler).
- Tests : `node --test` (Node lit le TypeScript), sur les modules purs. Pas de Vitest (trop de dépendances).
- Installation : `npm ci --ignore-scripts` à la racine (espaces de travail npm, un seul lockfile).

## PWA (`apps/web`)
- React + Vite + TypeScript strict. Composants fonctionnels.
- Ce qui lui est propre : `infra/audio`, `infra/offline` (service worker, Cache API), `ui/`, et `main.tsx`, seul point d'assemblage.
- `ui` et `infra` ne s'importent pas, et ne prennent du code partagé que `core` (plus `ui` du partagé, pour `ui`). `src/architecture.test.ts` le vérifie.
- Service worker et manifest écrits à la main (pas de `vite-plugin-pwa` : trop de dépendances via workbox).
- Audio : un seul élément `<audio>`, jamais Web Audio. Gestionnaires Media Session enregistrés dans l'événement `playing`.
- Hors ligne : cache par identifiant d'épisode, jamais par URL (les URLs signées changent). Réponses 206 depuis le cache pour les requêtes Range.
- Types de l'API alignés sur `contracts/openapi.yaml` (outil de génération à choisir ; en attendant, types écrits à la main dans `packages/shared/src/http/types.ts`, traduits en entités de `core/domain` par `http/`).

## App mobile (`apps/mobile`)
- Expo (React Native), ADR-0008. Écrans dans `src/app/` (expo-router : un fichier par écran), composants dans `src/ui/`.
- Comme la PWA : `infra/audio` (expo-audio, écran verrouillé), `infra/offline` (expo-file-system), `src/main.ts` seul point d'assemblage, `src/architecture.test.ts`.
- Téléchargements dans le cache de l'appli, jamais dans Documents : Apple refuse qu'un contenu re-téléchargeable parte dans la sauvegarde iCloud.
- Accessibilité : `accessibilityRole` et libellé sur chaque élément touchable, cibles de 48 points au moins.
- Style du site : palette et polices dans `src/ui/theme.ts` ; Lalezar et Literata en TTF dans `assets/fonts/` (provenance dans son README), symbole et icônes dans `assets/images/`.
- Pièges :
  - jamais de `fontWeight` avec nos polices : Android changerait de police. Une graisse = un fichier (`fonts.texteAppuye`) ;
  - pas de `<Link asChild>` autour d'un `Pressable` dont le style dépend de `pressed` : le style est perdu. Naviguer avec `router.push` ;
  - pas de fichier `expo-env.d.ts` : sans `typedRoutes`, `expo start` le supprime et réécrit `tsconfig.json`. Les types d'Expo passent par `src/expo-types.d.ts`.

## Audio
- Cloudflare R2, bucket privé, juridiction EU. Clés : `<langue>/<numéro>-<slug>/audio-128.mp3`.
- L'API vérifie l'accès puis renvoie une URL signée courte. L'audio ne passe jamais par le VPS.
- CORS du bucket : `app.rawiaudio.com`, et `http://localhost:5180` pour la PWA en dev (`ops/r2-cors.json`).

## Dépendances (règle de Salim)
- Jamais de bibliothèque qui a elle-même plus de 3 dépendances. Comptage : mainteneurs tiers dans l'arbre, hors dépendances de test et modules `golang.org/x`.
- La plateforme (Go, Node, Vite, React, React Native, Expo et ses modules officiels `expo-*`, avec ce qu'exige `expo-router`) n'entre pas dans ce comptage ; tout ce qu'on ajoute par-dessus, si (ADR-0008).
- Avant tout ajout : demander, montrer le compte de dépendances, justifier. Versions épinglées, lockfile commité, `npm ci --ignore-scripts`.
- Versions de plus de 15 jours, dépendances indirectes comprises : installer ou mettre à jour avec `npm install --ignore-scripts --before="$(date -u -d '15 days ago' +%FT%TZ)"` (npm 10 ignore `min-release-age`).
- Déjà validées : `pgx` v5. Plus tard : `stripe-go`.

## Sécurité (non négociable)
- Accès refusé par défaut : chaque route déclare son niveau d'accès.
- Un test d'autorisation par route : l'utilisateur A ne lit jamais les données de B.
- Auth : jetons et codes OTP stockés hachés, expiration courte, 5 essais maximum, limitation de débit par IP et par e-mail.
- Webhooks Stripe : signature vérifiée sur le corps brut, idempotence par `event.id` stocké en base.

## Zones sensibles : règle de travail
- Auth (lien magique, OTP, sessions), Stripe (checkout, webhooks), ledger (mois offerts, parrainage) :
  - Salim écrit le code.
  - Claude Code explique, propose la structure, relit, pointe ce qui casse, écrit des tests si demandé.
  - Claude Code n'écrit pas l'implémentation, sauf demande explicite.
- Partout ailleurs : Claude Code peut écrire, Salim relit chaque diff.
- Quand Salim ne comprend pas du Go : expliquer en comparant avec l'équivalent TypeScript.

## Ordre de construction
1. Prototype audio jetable pour les tests iPhone (`spikes/audio-pwa/`).
2. Socle API : `/health`, config, migrations, Docker.
3. Catalogue en lecture (épisodes, séries).
4. URLs signées R2.
5. PWA : catalogue, lecteur, hors ligne.
6. Connexion : lien magique + code OTP.
7. Plus tard : Stripe, parrainage, abonnement offert.

Une tranche à la fois. Pas de fonctionnalité hors de la tranche en cours.

## Ops (VPS OVH)
- Une stack Docker Compose par site, un seul Caddy en frontal (hors de ce repo), un Postgres par stack, un réseau Docker par stack, des limites mémoire.
- Le VPS héberge aussi l'Institut Al-Ihsan : ne jamais toucher à sa stack.
- La stack de Rawi est décrite dans `ops/`. Les procédures d'incident vont dans `ops/runbooks/`.
- Pour l'ops, Salim tape les commandes ; Claude Code explique le pourquoi.

## Conventions
- Commentaires et documentation en français.
- Commandes toujours complètes, prêtes à coller.
- Petits commits, un sujet par commit.
- Messages de commit : Conventional Commits, sans numéro (Rawi n'a pas de tickets), description en français. Exemple : `feat(api): ajoute GET /health`. Cette règle prime sur la configuration globale.
- Toute décision structurante : un ADR court dans `docs/adr/`.
- Ne jamais : toucher aux repos site ou studio, ajouter une dépendance, toucher à la production, sans demande explicite.
