# Polices de l'app

Les mêmes que le site rawiaudio.com et la PWA, en TTF : React Native ne lit pas le woff2.

| Fichier | Usage |
|---|---|
| `Lalezar-Regular.ttf` | titres et grands numéros (latin et arabe) |
| `Literata-Regular.ttf` | texte |
| `Literata-SemiBold.ttf` | texte appuyé (titres de ligne, boutons) |

Fabrication, depuis les woff2 du site, avec fontTools :
- Literata : instances fixes de la police variable (`wght` 400 et 600, `opsz` 18), chacune avec son propre nom, sinon iOS confond les deux graisses ;
- Lalezar : fusion des deux sous-ensembles du site, latin et arabe.

Licence : SIL Open Font License 1.1 (`OFL.txt`), qui permet de les modifier et de les embarquer dans l'app.
