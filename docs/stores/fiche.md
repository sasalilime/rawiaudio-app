# Fiche des stores (ADR-0013)

Brouillon du 27 octobre 2026, à relire par Salim. Les limites de longueur sont vérifiées par le script en bas de page.

Règles qui s'appliquent à tous les textes :
- l'app ne vend rien (ADR-0010) : ni prix, ni « abonnez-vous », ni lien vers un paiement, dans la fiche comme dans l'app ;
- pas de superlatif invérifiable (« la meilleure appli ») : Apple et Google les refusent ;
- même ton que le site : vouvoiement, simple, doux ;
- « un nouvel épisode chaque mois » est une promesse : à garder seulement si le rythme de production la tient.

## Commun aux deux stores

**Nom** (30 caractères au plus) : `Rawi Audio`

**Description** (4 000 caractères au plus) :

> Rawi Audio raconte les histoires du Coran et des Prophètes, pour les enfants comme pour les parents.
>
> Des récits fidèles
> Chaque épisode suit le texte du Coran et des livres de tafsir et d'histoire reconnus. Ses sources sont données sous son résumé : vous pouvez les vérifier.
>
> Sans musique
> Une voix posée, sans musique : pour le coucher, la voiture ou un moment calme en famille.
>
> Pensée pour les familles
> • Des séries à écouter dans l'ordre, partie après partie
> • « Une histoire au hasard » parmi celles que vous n'avez pas encore écoutées
> • Téléchargement des épisodes, pour écouter sans connexion
> • Écoute en arrière-plan et depuis l'écran verrouillé
> • Un compte facultatif, sans mot de passe : l'historique d'écoute suit la famille sur tous ses appareils
> • Ni publicité, ni traceur
>
> Un nouvel épisode chaque mois, inchâAllâh.

## App Store

- **Sous-titre** (30) : `Histoires du Coran en audio`
- **Texte promotionnel** (170, modifiable sans nouvelle version) : `Les histoires du Coran et des Prophètes, racontées sans musique, avec leurs sources. Un nouvel épisode chaque mois.`
- **Mots-clés** (100, séparés par des virgules, sans espace) : `islam,coran,prophètes,histoires,enfants,musulman,conte,récit,tafsir,famille,coucher,sira`
- **Catégories** : Livres (principale), Éducation (secondaire). Pas la catégorie « Enfants » (ADR-0010).
- **Âge** : 4+.
- **URL d'assistance** : `https://rawiaudio.com` ; **URL de confidentialité** : `https://rawiaudio.com/confidentialite`.

## Google Play

- **Description courte** (80) : `Histoires du Coran et des Prophètes en audio, sans musique, pour la famille.`
- **Catégorie** : Livres et références.
- **Public visé** : parents et enfants (règles « Familles », ADR-0013).
- **Coordonnées** : `contact@rawiaudio.com`, `https://rawiaudio.com` ; confidentialité : `https://rawiaudio.com/confidentialite`.

## Captures d'écran à prendre

Sur un vrai téléphone, avec de vrais épisodes, après le 30 octobre (iPhone 6,9 pouces et Android) :
1. Le catalogue (« Une histoire au hasard », dernier épisode, thèmes).
2. Un épisode : illustration, résumé et sources.
3. Une série, avec sa progression.
4. L'écran verrouillé pendant l'écoute.
5. Un épisode téléchargé, « Disponible sans connexion ».

## Vérifier les longueurs

```bash
cd docs/stores && node -e '
const t = { nom: "Rawi Audio", sousTitre: "Histoires du Coran en audio", courte: "Histoires du Coran et des Prophètes en audio, sans musique, pour la famille.",
  promo: "Les histoires du Coran et des Prophètes, racontées sans musique, avec leurs sources. Un nouvel épisode chaque mois.",
  motsCles: "islam,coran,prophètes,histoires,enfants,musulman,conte,récit,tafsir,famille,coucher,sira" }
const max = { nom: 30, sousTitre: 30, courte: 80, promo: 170, motsCles: 100 }
for (const [k, v] of Object.entries(t)) console.log(k.padEnd(10), [...v].length, "/", max[k], [...v].length <= max[k] ? "ok" : "TROP LONG")'
```
