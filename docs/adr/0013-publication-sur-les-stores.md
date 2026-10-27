# ADR-0013 : Publication sur l'App Store et Google Play

**Statut :** Proposé, à valider par Salim (questions en fin de document)
**Date :** 27 octobre 2026
**Décideur :** Salim
**Prévu par :** ADR-0008 (« la publication sur les stores fera l'objet d'un ADR à part »)

## Contexte
- L'app Expo est à égalité avec la PWA : catalogue, séries, lecteur avec écran verrouillé, téléchargements, illustrations. Elle passe aux versions finales de React Native et d'Expo le 30 octobre 2026 (ADR-0008), avant tout build installé sur un téléphone.
- ADR-0010 : les applis ne vendent rien (« reader app » chez Apple, « consumption-only » chez Google) ; pas de catégorie « Enfants » chez Apple.
- Tant que l'abonnement (tranche 7) n'existe pas, tout le catalogue est gratuit. L'app peut donc sortir avant la connexion et le paiement, et commencer à se faire connaître.
- Faits relevés le 27 octobre 2026 :
  - **Apple** : 99 $ par an, en monnaie locale. Un entrepreneur individuel s'inscrit **comme individu**, et son nom légal s'affiche comme vendeur. Le compte d'organisation demande une personne morale et un numéro D-U-N-S (gratuit, quelques jours).
  - **Apple, Union européenne (DSA)** : un « trader » doit faire afficher son adresse, son téléphone et son e-mail sur la fiche de l'App Store. Est trader celui qui exerce une activité commerciale ; une app gratuite d'un vendeur d'abonnements l'est très probablement. Apple refuse une boîte postale pour l'inscription, mais l'accepte pour l'adresse affichée, avec un justificatif.
  - **Google Play** : 25 $ une seule fois. Un **compte personnel** ouvert après le 13 novembre 2023 doit faire tester chaque nouvelle app en **test fermé par au moins 12 testeurs, inscrits sans interruption pendant 14 jours**, avant d'avoir le droit de publier. Puis Google relit la demande (environ une semaine). Compter trois semaines. Un compte d'organisation (avec D-U-N-S) en est dispensé.
  - **Google, règles « Familles »** : une app dont le public visé comprend des enfants doit les respecter. Pas de publicité ni de SDK non certifié pour les enfants, une politique de confidentialité, et aucune connexion par un SDK tiers non approuvé. Rawi n'a ni publicité, ni outil de mesure, ni SDK tiers : ces règles ne lui coûtent presque rien.
  - **Builds** : EAS Build (Expo), plan gratuit de 15 builds Android et 15 builds iOS par mois, avec une file d'attente lente. Un build iOS demande un Mac, ou EAS dans le cloud. Les builds locaux restent gratuits (`eas build --local`, il faut le SDK Android, ou Xcode pour iOS).

## Proposition
- **Android d'abord.** Un APK de test s'installe sans compte payant ; Salim l'essaie sur son téléphone après le 30 octobre.
- **Comptes** (voir la question 1) : individuel chez Apple. Chez Google, l'organisation si une structure avec un D-U-N-S existe d'ici là ; sinon un compte personnel, et lancer le test fermé tôt.
- **Les 12 testeurs** : des familles de la liste d'attente du site (inscrits de `rawiaudio.com`), plus l'entourage. On les invite par le lien de test de Google ; ils servent aussi de premiers retours sur l'app. Ne jamais acheter de testeurs : Google ferme les comptes pour ça.
- **iPhone** : TestFlight pour les essais (les testeurs externes passent par une relecture rapide d'Apple), puis la soumission.
- **Builds avec EAS**, plan gratuit : pas de Mac nécessaire pour iOS. Un fichier `eas.json` avec trois profils :
  - `development` : build de développement, pour l'écran verrouillé ;
  - `preview` : APK à installer à la main ;
  - `production` : AAB pour Google, IPA pour Apple.
- **Déclarations dans les consoles** :
  - public visé chez Google : parents **et** enfants, puisque les histoires leur sont destinées. Les règles « Familles » sont déjà respectées ; les relire avant chaque soumission ;
  - âge chez Apple : 4+, hors catégorie « Enfants » (ADR-0010) ;
  - données collectées (étiquettes de confidentialité Apple, section « Sécurité des données » de Google) : aucune avant la connexion ; ensuite l'e-mail du compte, lié à la personne, ni partagé ni utilisé pour la publicité, et supprimable depuis l'app ;
  - pas de publicité, pas d'achat dans l'app.
- **Dans l'app, avant la première soumission** :
  - un lien vers la politique de confidentialité, facile à trouver. Apple l'exige dans l'app **et** dans la fiche (règle 5.1.1(i)). Il faut donc d'abord la page sur le site (repo `rawiaudio-site`), puis un écran « À propos » (version, confidentialité, contact, site) ;
  - l'écran de démarrage aux couleurs de Rawi (`expo-splash-screen`, module officiel, à installer) ;
  - avec la tranche 6 : la suppression du compte depuis l'app (ADR-0012).
- **Fiches** : nom « Rawi Audio », sous-titre, description, captures d'écran (iPhone 6,9 pouces et Android), icône déjà prête. URL d'assistance et de confidentialité sur `rawiaudio.com`.

## Questions pour Salim
1. **Structure juridique** : vendre l'abonnement demande une activité déclarée (micro-entreprise ou société). Chez Apple, une micro-entreprise s'inscrit comme individu (ton nom comme vendeur). Chez Google, une société avec D-U-N-S évite les 14 jours de test. Laquelle vises-tu, et quand ? À voir avec le comptable, avec la question de la TVA (ADR-0010).
2. **Adresse affichée** (Apple, UE) : domiciliation d'entreprise, ou ton adresse personnelle ? La même question se pose pour les mentions légales du site.
3. **Sortir avant l'abonnement** : publier l'app gratuite dès qu'elle est prête, sans connexion, puis ajouter le cadenas avec la tranche 7 ?
4. **Expo** : créer un compte Expo (gratuit) et utiliser EAS Build, plutôt que des builds locaux ?
5. **Testeurs** : écrire aux inscrits de la liste d'attente pour le test fermé ?

## Conséquences
- Ajout de `apps/mobile/eas.json`. `eas-cli` est lancé par `npx` avec une version fixe, comme `wrangler` : rien dans les dépendances.
- La page de confidentialité du site devient un prérequis des deux stores.
- Les règles des stores changent souvent : relire les règles « Familles » de Google, la règle 3.1.3(a) d'Apple et le statut de trader avant chaque soumission.
- Coût de départ : 99 $ par an (Apple) et 25 $ une fois (Google), plus une éventuelle domiciliation.

## Ordre proposé
1. Après le 30 octobre : versions finales, APK `preview` sur le téléphone de Salim, essai complet (lecture, écran verrouillé, hors ligne).
2. Page de confidentialité sur le site, écran « À propos », écran de démarrage.
3. Comptes Google et Apple, statut de trader.
4. Test fermé Google (14 jours) et TestFlight, en parallèle.
5. Fiches et soumission.

## Sources
- [Google, test des apps pour les nouveaux comptes personnels](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- [Google, données des apps Familles](https://support.google.com/googleplay/android-developer/answer/11043825?hl=en), [Google, public visé](https://support.google.com/googleplay/android-developer/answer/9867159?hl=en-GB)
- [Apple, inscription au programme développeur](https://developer.apple.com/programs/enroll/), [Apple, statut de trader (DSA)](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/)
- [Apple, règles de l'App Store](https://developer.apple.com/app-store/review/guidelines/)
- Tarifs EAS : [Newly, EAS Build](https://newly.app/guides/eas-build) (relevés sur la page de prix d'Expo en septembre 2026, à revérifier sur expo.dev/pricing)
