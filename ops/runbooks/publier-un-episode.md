# Publier un épisode dans l'appli

Procédure à la main, en attendant l'import depuis `rawiaudio-studio` (ADR à écrire).
Un épisode n'apparaît dans l'appli qu'une fois publié : `published_at` renseigné et atteint.

Tout se lance depuis le poste de dev, à la racine du repo. Le SQL part sur le VPS par SSH : `ssh vps '…'` lance la commande sur le serveur, et lui passe ce qu'on écrit après `<<'SQL'`. `sudo -u rawi psql` s'y connecte à la base sous l'utilisateur `rawi`, sans mot de passe (ADR-0011).

## 1. Le fichier audio (depuis le poste de dev)
Format attendu : MP3 à 128 kbit/s, mono. Vérification :
```bash
ffprobe -v error -show_entries format=bit_rate,duration:stream=channels -of default=nw=1 <fichier>.mp3
```
Dépôt dans R2, sous la clé de l'ADR-0003 (`<langue>/<numéro sur 3 chiffres>-<slug>/audio-128.mp3`) :
```bash
npx wrangler@4.142.0 r2 object put rawi-audio/fr/005-<slug>/audio-128.mp3 --file <fichier>.mp3 --content-type audio/mpeg --jurisdiction eu --remote
```

## 2. L'illustration (depuis le poste de dev, ADR-0009)
Source : l'illustration **sans texte** du studio (pas la miniature YouTube). Facultative : sans elle, l'appli garde son affichage habituel.

Conversion en WebP 960 × 540, recadré au centre, qualité 70, sans métadonnées :
```bash
ffmpeg -i <illustration>.png -vf "scale=960:540:force_original_aspect_ratio=increase,crop=960:540" -c:v libwebp -quality 70 -compression_level 6 -map_metadata -1 image-16x9.webp
```
Contrôle (attendu : `960,540`, puis `OK`) :
```bash
ffprobe -v error -show_entries stream=width,height -of csv=p=0 image-16x9.webp
[ "$(stat -c %s image-16x9.webp)" -le 61440 ] && echo OK || echo "TROP LOURD : refaire la conversion avec -quality 60"
```
La clé finit par 6 caractères aléatoires : le bucket est public, et une image déposée avant la sortie de l'épisode ne doit pas se deviner à partir de son titre. Noter la clé affichée, elle sert aux étapes 3 et 7.
```bash
cle="fr/005-<slug>/image-16x9-$(openssl rand -hex 3).webp"; echo "$cle"
```
Dépôt dans le bucket public `rawi-images` (créé une fois, voir en bas), avec un cache d'un an :
```bash
npx wrangler@4.142.0 r2 object put "rawi-images/$cle" --file image-16x9.webp --content-type image/webp --cache-control "public, max-age=31536000, immutable" --jurisdiction eu --remote
```
- Une image déposée ne se remplace jamais sous la même clé : téléphones et cache de Cloudflare la gardent un an. Pour la changer, la déposer sous une nouvelle clé tirée de la même façon, puis mettre la base à jour : `UPDATE episodes SET image_key = '<nouvelle clé>' WHERE id = 'fr-005'`.

## 3. L'épisode en base, non publié
`image_key` : la clé affichée à l'étape 2, ou `NULL` sans illustration.
```bash
ssh vps 'sudo -u rawi psql -d rawi -v ON_ERROR_STOP=1' <<'SQL'
INSERT INTO episodes (id, lang, number, slug, title, reference, duration_seconds, series_id, image_key)
VALUES ('fr-005', 'fr', 5, '<slug>', '<Titre>', 'Sourate <…>, versets <…>', <durée en secondes>, NULL, '<clé de l''étape 2>');
SQL
```
- Une apostrophe dans un texte SQL s'écrit deux fois : `'L''homme'`.
- La base refuse un identifiant qui ne correspond pas à la langue et au numéro, un slug avec majuscules ou espaces, et une langue inconnue.
- Elle refuse aussi une clé d'illustration hors du dossier de l'épisode (`fr/005-<slug>/`), ou qui n'est pas un `.webp`.

## 4. Le ou les thèmes
Un épisode peut entrer dans plusieurs thèmes ; sans thème, il s'affiche dans « Autres histoires ».
Liste des thèmes : `echo "SELECT id, title FROM themes ORDER BY position" | ssh vps 'sudo -u rawi psql -d rawi'`.
```bash
ssh vps 'sudo -u rawi psql -d rawi -v ON_ERROR_STOP=1' <<'SQL'
INSERT INTO episode_themes (episode_id, theme_id, lang) VALUES ('fr-005', 'fr-prophetes', 'fr');
SQL
```

## 5. Sources et résumé, recopiés de la fiche validée du studio
Jamais rédigés ailleurs. Les sources sont des liens Shamela de la matrice `studio/docs/sources.md` : la base refuse tout autre lien.
```bash
ssh vps 'sudo -u rawi psql -d rawi -v ON_ERROR_STOP=1' <<'SQL'
BEGIN;
INSERT INTO episode_sources (episode_id, position, label, url) VALUES
    ('fr-005', 1, '<livre, tome, page>', 'https://shamela.ws/book/<livre>/<page>');
UPDATE episodes SET summary = ARRAY['<paragraphe 1>', '<paragraphe 2>'] WHERE id = 'fr-005';
COMMIT;
SQL
```

## 6. Publication
Date et heure en UTC ; une date future programme la sortie.
```bash
echo "UPDATE episodes SET published_at = '2026-11-06 06:00:00+00' WHERE id = 'fr-005'" | ssh vps 'sudo -u rawi psql -d rawi -v ON_ERROR_STOP=1'
```

## 7. Vérification
```bash
curl -s "https://api.rawiaudio.com/episodes/fr-005" | head -c 300; echo
curl -s "https://api.rawiaudio.com/episodes/fr-005/audio" | head -c 120; echo
curl -sI "https://media.rawiaudio.com/<clé de l'étape 2>" | grep -iE '^(HTTP|content-type|cache-control|cf-cache-status)'
```
- La fiche doit contenir les sources, et `imageUrl` si l'épisode a une illustration.
- La deuxième commande doit renvoyer une URL : ouvrir l'épisode dans l'appli et l'écouter quelques secondes.
- La troisième doit donner `200`, `image/webp` et le `cache-control` d'un an. Relancée, elle doit montrer `cf-cache-status: HIT` : l'image vient du cache de Cloudflare, pas de R2.

## Épisodes 1 à 4
`ops/episodes/0001-episodes-1-a-4.sql` les crée non publiés (étape 3), d'après le site, puis `0002-themes.sql` crée les 10 thèmes et les y range (étape 4). Une seule fois, dans cet ordre :
```bash
ssh vps 'sudo -u rawi psql -d rawi -v ON_ERROR_STOP=1' < ops/episodes/0001-episodes-1-a-4.sql
ssh vps 'sudo -u rawi psql -d rawi -v ON_ERROR_STOP=1' < ops/episodes/0002-themes.sql
```
- Audio sur R2 au 26/10/2026 : épisodes 1, 2 et 3. Épisode 4 : choisir entre `younous_ep_4.mp3` (128 kbit/s, mono) et `younous_ep_4_ambiance.mp3` (192 kbit/s, stéréo, à réencoder).
- Restent les étapes 5 et 6 pour chacun, avec les fiches du studio.
- Illustrations : à demander au studio, sans texte (étape 2), puis `UPDATE episodes SET image_key = …` pour chacun.

## Une seule fois : le bucket des illustrations (ADR-0009)
Depuis la racine du repo, sur le poste de dev.

1. Le bucket, en juridiction EU comme celui de l'audio :
   ```bash
   npx wrangler@4.142.0 r2 bucket create rawi-images --jurisdiction eu
   ```
2. Le CORS, le même que pour l'audio (`ops/r2-cors.json`) : la PWA télécharge l'image avec l'audio pour le hors ligne.
   ```bash
   npx wrangler@4.142.0 r2 bucket cors set rawi-images --file ops/r2-cors.json --jurisdiction eu
   ```
3. Le domaine `media.rawiaudio.com`. L'identifiant de zone est dans le tableau de bord Cloudflare : site `rawiaudio.com`, page « Overview », encadré « API », « Zone ID ». Cloudflare crée lui-même l'enregistrement DNS.
   ```bash
   npx wrangler@4.142.0 r2 bucket domain add rawi-images --domain media.rawiaudio.com --zone-id <zone-id> --min-tls 1.2 --jurisdiction eu
   ```
4. L'adresse `r2.dev` doit rester désactivée (réservée au développement, débit limité). Attendu : désactivée.
   ```bash
   npx wrangler@4.142.0 r2 bucket dev-url get rawi-images --jurisdiction eu
   ```
5. Vérification, quelques minutes plus tard : le domaine répond, sans lister le contenu du bucket. Attendu : `HTTP/2 404`.
   ```bash
   curl -sI https://media.rawiaudio.com/ | head -1
   ```
