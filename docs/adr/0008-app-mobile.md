# ADR-0008 : App mobile et code partagé

**Statut :** Accepté
**Date :** 26 octobre 2026
**Décideur :** Salim

## Contexte
- L'ADR-0001 prévoit une app Expo (React Native) après la PWA. Salim choisit de la commencer dès maintenant, pendant que la mise en ligne attend l'accès au VPS.
- La PWA suit la Clean Architecture (ADR-0004) : son cœur ne dépend ni du navigateur ni de React. Il peut servir aux deux clients.
- Salim a un iPhone et un téléphone Android pour les essais.

## Décision
- **Code partagé** : `packages/shared`, dans des espaces de travail npm (un seul lockfile, à la racine). On y importe `@rawiaudio/shared/<dossier>/<fichier>.ts`. Il contient :
  - `core/` : domaine, ports, cas d'usage ;
  - `http/` : client de l'API, avec `fetch`, présent partout ;
  - `storage/` : stockages clé-valeur sur l'interface `Storage` ;
  - `ui/` : le React sans DOM (contexte des cas d'usage, hooks, textes, formats), pour ne pas écrire deux fois la logique d'un bouton.
- **Ce qui ne se partage pas** : les composants affichés (React DOM d'un côté, React Native de l'autre), le lecteur audio et les téléchargements de chaque plateforme.
- **App mobile** (`apps/mobile`) : Expo SDK 58, avec :
  - `expo-router` pour la navigation ;
  - `expo-audio` pour la lecture (arrière-plan et écran verrouillé) ;
  - `expo-file-system` pour les téléchargements ;
  - `expo-network` pour savoir si le téléphone est connecté : hors ligne, « une histoire au hasard » ne tire que parmi les épisodes téléchargés ;
  - `expo-sqlite`, dont le `localStorage` fait tourner sans changement les stockages partagés.
- **Règle des dépendances** : React Native, Expo, ses modules officiels `expo-*` et ce qu'exige `expo-router` comptent comme plateforme (`CLAUDE.md`). Il n'y a pas d'autre choix réaliste pour une app native.
- **Versions** : la règle des 15 jours impose Expo 58.0.7, qui s'appuie sur React Native `0.88.0-rc.4`. C'est **pour le développement seulement**. On passera aux versions finales (React Native 0.88.0, Expo 58.0.11 ou plus) dès qu'elles auront 15 jours, le 30 octobre 2026, avant tout build installé sur un téléphone.
  - En attendant, `overrides` (`package.json` de la racine) force `react-native` en `0.88.0-rc.4` partout. Sans lui, npm installe un second React Native, le 0.87.1 : en semver, la plage `*` des modules Expo exclut les préversions. On le retire avec le passage aux versions finales.
  - La règle vaut aussi pour les dépendances indirectes : `npm install --before` (README).
- **Essais** :
  - Expo Go pour les écrans et la lecture appli ouverte ;
  - un « development build » pour l'écran verrouillé. Sur Android, c'est un simple APK, sans compte payant. Sur iPhone, il faut le compte développeur Apple, à décider le moment venu.

## Conséquences
- Une règle métier écrite une fois (rangement, séries, tirage au hasard, enchaînement) vaut pour les deux clients, avec les mêmes tests.
- Les tests d'architecture vérifient chaque paquet. La PWA et l'app mobile ne prennent du code partagé que `core` (plus `ui` pour leurs composants), sauf leur point d'assemblage.
- `npm audit` signale des failles dans les outils de dev d'Expo (`@expo/cli`, préparation des projets natifs), rien qui parte dans l'app :
  - `node-forge` (GHSA-86w9-cpqp-85rv) : aucune version corrigée n'existe. Il sert à signer les mises à jour à distance (`expo-updates`), qu'on n'utilise pas ;
  - `zod` 3 (GHSA-mrhx-c7xc-m3w5) : corrigé seulement en zod 4, que `@expo/cli` 58 n'accepte pas. Le risque est une saturation mémoire sur une entrée locale ;
  - `uuid` 7, via `xcode` (GHSA-w5hq-g745-h8pq) : manque de contrôle de taille quand un tampon est fourni, pendant la génération du projet iOS, sur le poste.
  On refait le point au passage aux versions finales, le 30 octobre.
- Téléchargements dans le cache de l'appli : expo-file-system ne sait pas exclure un fichier de la sauvegarde iCloud, qu'Apple refuse pour du contenu re-téléchargeable. Le système peut vider ce cache quand le téléphone est presque plein, comme Safari pour la PWA.
- Apparence : celle du site et de la PWA. Polices Lalezar et Literata en TTF (`expo-font`), tirées des woff2 du site ; icône d'après le kit de marque (casque sans le mot, sur nuit) ; l'accueil reprend l'en-tête du site (symbole, nom, accroche).
- Pas encore traité dans l'app mobile :
  - l'écran de démarrage aux couleurs de Rawi : il demande `expo-splash-screen` (module officiel, à installer) ;
  - les illustrations des épisodes, comme sur le site : il faut d'abord les servir par l'API ;
  - l'image de l'écran verrouillé, prise sur la PWA une fois en ligne.
- L'app mobile parle à la même API. Sans l'API en ligne, l'essai sur téléphone demande le même Wi-Fi que le poste de dev.
- La publication sur l'App Store et sur Google Play (comptes, fiches, règles des applis pour enfants) fera l'objet d'un ADR à part.
