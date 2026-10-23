# ADR-0001 : Stack technique de Rawi Audio

**Statut :** Accepté
**Date :** 23 octobre 2026
**Décideur :** Salim

## Contexte
- Appli d'histoires islamiques audio pour familles : PWA d'abord, applis mobiles ensuite, abonnement Stripe quand le catalogue le justifie (30 épisodes et plus, vers le printemps 2027).
- Développeur seul, le soir, à côté d'un emploi. Le code est écrit en grande partie avec Claude Code et relu par Salim.
- Objectif : une seule stack pour toute la vie du projet, sans réécriture v1 → v2.
- Charge attendue : environ 1 requête/seconde en pointe à 1 000 abonnés. L'audio ne passe pas par l'API.
- Un VPS OVH existe déjà, et doit héberger plusieurs sites (dont l'Institut Al-Ihsan) en Docker Compose.
- Règle de dépendances : jamais de bibliothèque avec plus de 3 dépendances.

## Décision
- **API en Go** : `net/http` de la stdlib, `pgx` v5, validation et migrations maison.
- **Hébergement de l'API** : VPS OVH, Docker Compose, Caddy en frontal, Postgres dédié.
- **Audio** : Cloudflare R2 (bucket privé, juridiction EU), URLs signées. Miroir de sauvegarde sur le VPS.
- **PWA** : React + Vite + TypeScript, fichiers statiques sur Cloudflare.
- **Mobile** : Expo (React Native) plus tard, builds iOS dans le cloud (pas de Mac).
- **Repos** : un nouveau repo `rawiaudio-app` pour le produit (PWA, API, contrat OpenAPI, stack ops de Rawi, mobile plus tard). `rawiaudio-site` et `rawiaudio-studio` restent séparés et inchangés.

## Options considérées

### Option A : Hono / TypeScript sur Cloudflare Workers + D1
| Dimension | Évaluation |
|---|---|
| Complexité | Faible |
| Coût | 0 à 5 $/mois |
| Ops | Quasi nulle |
| Maîtrise de Salim | Forte |

**Pour :** livraison rapide, relecture solide, types partagés avec la PWA.
**Contre :** D1 sans transactions interactives, supply chain npm, aucun apprentissage de l'ops.

### Option B : Node/TypeScript sur le VPS
**Pour :** relecture solide, Postgres complet.
**Contre :** supply chain npm, churn des dépendances sur 10 ans.

### Option C : Go sur le VPS (retenue)
| Dimension | Évaluation |
|---|---|
| Complexité | Moyenne |
| Coût | VPS déjà payé + R2 quasi gratuit |
| Ops | 2 à 4 h/mois après installation |
| Maîtrise de Salim | En apprentissage |

**Pour :** stabilité sur 10 ans (promesse Go 1), stdlib large, peu de dépendances, un binaire, cohérence avec ses autres projets Go, valeur sur le marché.
**Contre :** démarrage plus lent, relecture du Go encore fragile, types partagés via un contrat OpenAPI.

## Analyse des compromis
- La performance ne départage pas : la charge est minuscule pour les deux langages.
- Le risque principal de Go est la relecture de code sensible par un débutant. Il est maîtrisé par l'ordre de construction : 5 à 6 mois de Go en production sur des parties à faible risque avant d'écrire le paiement, et le code sensible écrit par Salim lui-même.
- Si le paiement devait ouvrir dans les 2 mois, TypeScript redeviendrait le bon choix.

## Conséquences
- Plus facile : maintenance sur la durée, sécurité de la chaîne de dépendances, déploiement uniforme sur le VPS.
- Plus difficile : vitesse des premières tranches, partage de types avec la PWA (contrat OpenAPI à maintenir).
- À revoir : outil de génération des types TS, choix de la bibliothèque audio pour Expo, besoin éventuel d'un routeur (chi), format d'échange entre `rawiaudio-studio` et l'appli (manifeste d'épisode).

## Actions
1. [ ] Tests audio PWA sur iPhone (prototype jetable).
2. [ ] Création du repo `rawiaudio-app`.
3. [ ] Socle API (`/health`, config, migrations, Docker).
4. [ ] Socle ops sur le VPS (SSH, pare-feu, Caddy, sauvegardes, surveillance).
5. [ ] Spec de la v1, puis tranche « catalogue + lecteur ».
