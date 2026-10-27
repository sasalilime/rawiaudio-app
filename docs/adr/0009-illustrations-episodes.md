# ADR-0009 : Illustrations des épisodes

**Statut :** Accepté
**Date :** 26 octobre 2026
**Décideur :** Salim

## Contexte
- Le studio produit pour chaque épisode (`studio/docs/pipeline.md`, étapes 5 et 6) :
  - une **illustration** 16:9, sans texte, palette stricte, sans visage ;
  - une **miniature YouTube** 1280 × 720 : l'illustration, plus une accroche en Lalezar et le logo.
- Le site affiche la miniature, déposée à la main dans son propre dépôt.
- La PWA et l'app mobile n'ont aujourd'hui aucune image d'épisode. L'écran verrouillé montre au mieux l'icône de l'appli.
- L'audio est privé (URL signée, ADR-0003). Les illustrations, elles, sont déjà publiques sur le site et YouTube.

## Décision
- **L'illustration sans texte**, pas la miniature :
  - recadrée en carré (écran verrouillé), la miniature perd son accroche (« 309 A », « UN ÉNOR ») ; l'illustration garde une scène ;
  - l'appli affiche déjà le titre, et une accroche en français ne convient ni à l'arabe ni à l'anglais.
- **Hébergement public**, sans signature :
  - un second bucket R2, `rawi-images`, servi par `media.rawiaudio.com` (zone déjà chez Cloudflare) ;
  - le bucket de l'audio reste privé et inchangé : rien de l'audio ne peut devenir public par erreur ;
  - pas d'adresse `r2.dev` : Cloudflare la réserve au développement, avec un débit limité ;
  - juridiction EU, comme l'audio : `wrangler r2 bucket domain add` accepte un bucket de juridiction EU ;
  - même CORS que l'audio (`ops/r2-cors.json`) : la PWA télécharge l'image avec l'audio pour le hors ligne ;
  - un bucket public ne permet pas de lister son contenu : on ne lit une image qu'en connaissant sa clé.
- **Poids des images** :
  - WebP 960 × 540, qualité 70, métadonnées retirées. Mesuré sur les quatre visuels du site : 15 à 41 Ko, contre 21 à 88 Ko en 1280 px, sans différence visible sur un écran d'iPhone ;
  - 60 Ko au plus, vérifié à la publication ;
  - clé `<langue>/<numéro>-<slug>/image-16x9-<6 caractères aléatoires>.webp` : le bucket est public, et une illustration déposée avant la sortie de l'épisode ne doit pas se deviner à partir de son titre (revue de sécurité du 27 octobre 2026). Une image publiée ne change jamais : pour la remplacer, on la dépose sous une nouvelle clé (`image-16x9-2.webp`) et on met la base à jour ;
  - déposée avec `Cache-Control: public, max-age=31536000, immutable` : téléphones, navigateurs et cache de Cloudflare la gardent un an, et R2 n'est presque jamais relu.
- **API** :
  - colonne `episodes.image_key`, facultative ;
  - champ `imageUrl` (adresse complète, ou `null`) dans chaque épisode, construit à partir de `IMAGES_BASE_URL` ;
  - sans image, les clients gardent l'affichage actuel.
- **Où l'afficher**, dans la PWA comme dans l'app mobile :
  - en tête de la fiche d'un épisode, en 16:9, coins arrondis, comme sur le site ;
  - pour le dernier épisode à l'accueil, en grande carte ;
  - sur l'écran verrouillé pendant la lecture, à la place de l'icône. expo-audio transmet l'image entière ; iOS et Android la placent dans leur cadre carré, sans la déformer. Pas de version carrée pour l'instant : à revoir si un recadrage coupe mal une scène ;
  - les autres lignes du catalogue gardent leurs grands numéros, plus lisibles quand la liste s'allonge.
- **Hors ligne** : l'illustration d'un épisode téléchargé est enregistrée avec son audio.
- **Publication** : une étape de plus dans `ops/runbooks/publier-un-episode.md` (conversion, contrôle du poids, dépôt), en attendant l'ADR sur le passage du studio à l'appli.

## Coût
- Tarifs R2 (vérifiés le 26 octobre 2026) : sortie de données gratuite ; gratuits chaque mois 10 Go de stockage et 10 millions de lectures ; au-delà, 0,015 $ par Go et par mois, et 0,36 $ par million de lectures.
- 1 000 épisodes à 40 Ko font 40 Mo : le stockage reste dans l'offre gratuite.
- Le poste qui pourrait coûter, ce sont les lectures. Le cache d'un an les absorbe : une image servie par le cache de Cloudflare n'atteint pas R2. La documentation ne l'écrit pas noir sur blanc ; c'est le principe même du cache.
- Le poids réduit sert surtout les familles : moins de données mobiles, des écrans qui s'affichent plus vite.

## Vérification (PWA, 27 octobre 2026)
Dans Chrome, avec la PWA construite, la vraie API et un faux `media.rawiaudio.com` qui répond comme R2 (CORS, cache d'un an) :
- l'illustration s'affiche en tête de la fiche et dans la carte du dernier épisode, et sur l'écran verrouillé (Media Session) ;
- au téléchargement d'un épisode, elle est gardée dans le cache `rawi-images-v1`, en réponse CORS de 40 Ko (pas une réponse opaque, qui compterait pour des Mo dans le quota) ;
- sans réseau, et le cache HTTP du navigateur vidé, elle s'affiche encore : c'est le service worker qui la sert ;
- sans copie ni réseau, elle disparaît de la page, sans icône d'image cassée.
- À vérifier sur iPhone : l'image de l'écran verrouillé sans réseau. Le navigateur la charge lui-même, peut-être sans passer par le service worker.

## App mobile (27 octobre 2026)
- Pas de service worker : l'interface demande l'adresse à afficher (`downloads.imageSource`), la copie gardée sur le téléphone (`Paths.cache/images`) ou l'adresse en ligne.
- L'écran verrouillé reçoit la même adresse : iOS (`URLSession`) et Android (`URL.openConnection`) lisent aussi une adresse `file://`, donc l'image d'un épisode téléchargé s'y affiche sans réseau.
- Vérifié dans l'aperçu web de l'app : carte du dernier épisode, fiche avec et sans illustration, image injoignable retirée. Pas encore vérifié sur téléphone : le téléchargement de l'image et son affichage hors ligne.

## Conséquences
- Une tranche qui touche le contrat, une migration, l'API, la PWA, l'app mobile et un runbook.
- Le studio doit garder l'illustration sans texte, en plus de la miniature.
- La création du bucket et du domaine se fait dans le tableau de bord Cloudflare, par Salim.
