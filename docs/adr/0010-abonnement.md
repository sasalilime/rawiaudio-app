# ADR-0010 : Abonnement — ce qui est gratuit, les prix, les applis mobiles

**Statut :** Accepté le 27 octobre 2026, sauf la question de la TVA, encore ouverte
**Date :** 27 octobre 2026
**Décideur :** Salim

## Contexte
- Modèle prévu (`CLAUDE.md`) : appli gratuite d'abord, abonnement Stripe quand le catalogue le justifie (30 épisodes et plus). Il faut d'abord des comptes : tranche 6 (connexion), puis tranche 7 (paiement).
- Règle de Salim (27 octobre 2026) : seule la première partie de chaque série est gratuite. YouTube ne compte pas : il n'y aura qu'un épisode long par mois et des shorts, qui servent à faire connaître l'appli.
- Vendre un abonnement à du contenu numérique **dans** une appli oblige en principe à passer par Apple ou Google, avec leur commission. Deux exceptions couvrent Rawi :
  - Apple, « reader apps » (règle 3.1.3(a)) : une appli dont le cœur est l'audio peut donner accès à ce qui a été payé ailleurs, sans achat dans l'appli. Elle peut demander l'« External Link Account Entitlement » pour un lien vers le site (créer ou gérer son compte). Aux États-Unis, ce lien n'a plus besoin d'autorisation.
  - Google, applis « consumption-only » : on se connecte et on écoute ce qui a été payé ailleurs. Interdit : un lien ou un texte qui pousse à payer hors de Google Play. Les programmes de liens externes en Europe prennent 10 à 20 % de commission.
- Prix relevés le 27 octobre 2026 :

| Appli | Mois | Année | Remarques |
|---|---|---|---|
| Tasnim (histoires islamiques, français) | 3,99 $ | 44,99 $ | achat dans l'appli iOS, 3 histoires gratuites |
| Muslim Story (France) | 7,99 € | 59,99 € | toute la famille, 19,99 € le trimestre |
| Miraj Stories (anglais) | 6,99 £ | 69,99 £ | essai 7 jours |
| BayaM (Bayard, 3-12 ans) | 6,99 à 9,99 € | 54,99 à 89,99 € | presque rien de gratuit |
| Lunii+ | 9,90 € | 99 € | pour les boîtes à histoires Lunii |

- Frais Stripe pour un compte français : 1,5 % + 0,25 € par paiement avec une carte européenne standard, plus environ 0,7 % pour la gestion des abonnements (Stripe Billing). La part fixe pèse lourd sur un petit prix :
  - 3,99 € par mois : environ 0,34 € de frais, soit 8,5 % ;
  - 39 € par an : environ 1,11 € de frais, soit 2,8 %.
  Un « merchant of record » (Paddle, Lemon Squeezy : environ 5 % + 0,50 €) prendrait 17 % d'un paiement de 3,99 €.

## Proposition
- **Gratuit, sans compte : la première partie de chaque série**, et rien d'autre. C'est une règle de l'API, calculée à partir du numéro de partie : rien à saisir à la publication.
  - Tout le reste est réservé aux abonnés, y compris les épisodes hors série et ceux publiés sur YouTube.
  - Pas d'essai avec carte bancaire : les premières parties en tiennent lieu. Il faut donc quelques séries au catalogue dès le lancement.
- **Vente sur le site seulement** (Stripe Checkout, et le portail client de Stripe pour gérer ou résilier). Les applis iOS et Android ne vendent rien : on s'y connecte et on écoute.
  - Elles n'affichent ni prix ni bouton « s'abonner » : un cadenas « Réservé aux abonnés » sur les épisodes payants, et c'est tout.
  - L'appli iOS demande l'« External Link Account Entitlement » pour un lien « Gérer mon compte ».
  - Ne pas classer l'appli dans la catégorie « Enfants » d'Apple : elle y interdit les liens sortants et les achats hors contrôle parental. Ce sont les parents qui ont le compte.
- **Prix** :
  - 3,99 € par mois, ou 39 € par an (moins de 3,25 € par mois, deux mois offerts). L'année est mise en avant : moins de frais, moins de résiliations ;
  - un abonnement par famille : un compte, tous les appareils du foyer ;
  - **prix de lancement** : 29 € par an pour tout abonnement annuel pris pendant le premier mois après le lancement. Ce prix est gardé à chaque renouvellement, tant que l'abonnement n'est pas résilié (Stripe garde le prix d'un abonnement existant quand on en crée un nouveau). L'e-mail du lancement à la liste du site l'annonce, avec sa date de fin ;
  - au lancement, le catalogue est petit (une trentaine d'épisodes de 5 minutes) : un prix bas, à revoir pour les nouveaux abonnés quand il grandira.
- **Parrainage et abonnement offert** : en tranche 7 aussi, sur le modèle déjà discuté (mois offerts dans un registre ; abonnement offert : paiement Stripe « Offrir » et attribution manuelle).

## Questions pour Salim
1. ~~Les épisodes publiés sur YouTube~~ : tranché le 27 octobre 2026, seule la première partie de chaque série est gratuite.
2. ~~Les prix~~ : acceptés le 27 octobre 2026, avec le prix de lancement à 29 € par an pendant le premier mois.
3. TVA : franchise en base ou non, ventes hors de France au-delà de 10 000 € par an ? La réponse décide entre Stripe seul, Stripe Tax et une déclaration par le guichet unique (OSS). À voir avec un comptable.

## Conséquences
- L'accès se décide à un seul endroit : l'API, avant de signer l'URL de l'audio (`service.Catalog.AudioURL`). Une seule règle pour la PWA et les applis.
- Le contrat de l'API gagne un champ « gratuit » par épisode, calculé par l'API, pour que les clients affichent le cadenas sans connaître la règle.
- Les épisodes gratuits marchent sans compte : la connexion n'est demandée que pour un épisode réservé.
- Les règles des stores changent souvent : les relire avant de soumettre les applis.

## Sources
- [Apple, règles de l'App Store (3.1.3(a))](https://developer.apple.com/app-store/review/guidelines/), [Apple, « reader apps »](https://developer.apple.com/support/reader-apps)
- [Google Play, règles de paiement](https://support.google.com/googleplay/android-developer/answer/10281818?hl=en), [Google Play, programme de choix du paiement](https://support.google.com/googleplay/android-developer/answer/17161464?hl=en-GB)
- Prix : [Tasnim](https://apps.apple.com/us/app/tasnim-islam-pour-enfants/id6761052343), [Muslim Story](https://apps.apple.com/fr/app/muslim-story/id6450928102), [Miraj](https://www.mirajstories.com/blog/best-islamic-apps-for-kids), [BayaM](https://aquarellissime.fr/guides/applications/bayam/), [Lunii+](https://lunii.com/fr-fr/lunii-abonnement)
- Frais Stripe : [calculateur, tarifs relevés le 5 octobre 2026](https://www.vincenthego.com/calculateur-frais-stripe/), [Indy, frais Stripe 2026](https://www.indy.fr/guide/comptabilite-en-ligne/commerce/stripe-comptabilite/frais-stripe/)
