# Publier un épisode dans l'appli

Procédure à la main, en attendant l'import depuis `rawiaudio-studio` (ADR à écrire).
Un épisode n'apparaît dans l'appli qu'une fois publié : `published_at` renseigné et atteint.

## 1. Le fichier audio (depuis le poste de dev)
Format attendu : MP3 à 128 kbit/s, mono. Vérification :
```bash
ffprobe -v error -show_entries format=bit_rate,duration:stream=channels -of default=nw=1 <fichier>.mp3
```
Dépôt dans R2, sous la clé de l'ADR-0003 (`<langue>/<numéro sur 3 chiffres>-<slug>/audio-128.mp3`) :
```bash
npx wrangler@4.142.0 r2 object put rawi-audio/fr/005-<slug>/audio-128.mp3 --file <fichier>.mp3 --content-type audio/mpeg --jurisdiction eu --remote
```

## 2. L'épisode en base, non publié (sur le VPS, depuis `ops/`)
```bash
docker compose exec -T db psql -U rawi -d rawi -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO episodes (id, lang, number, slug, title, reference, duration_seconds, series_id)
VALUES ('fr-005', 'fr', 5, '<slug>', '<Titre>', 'Sourate <…>, versets <…>', <durée en secondes>, NULL);
SQL
```
- Une apostrophe dans un texte SQL s'écrit deux fois : `'L''homme'`.
- La base refuse un identifiant qui ne correspond pas à la langue et au numéro, un slug avec majuscules ou espaces, et une langue inconnue.

## 3. Sources et résumé, recopiés de la fiche validée du studio
Jamais rédigés ailleurs. Les sources sont des liens Shamela de la matrice `studio/docs/sources.md` : la base refuse tout autre lien.
```bash
docker compose exec -T db psql -U rawi -d rawi -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
INSERT INTO episode_sources (episode_id, position, label, url) VALUES
    ('fr-005', 1, '<livre, tome, page>', 'https://shamela.ws/book/<livre>/<page>');
UPDATE episodes SET summary = ARRAY['<paragraphe 1>', '<paragraphe 2>'] WHERE id = 'fr-005';
COMMIT;
SQL
```

## 4. Publication
Date et heure en UTC ; une date future programme la sortie.
```bash
docker compose exec -T db psql -U rawi -d rawi -c "UPDATE episodes SET published_at = '2026-11-06 06:00:00+00' WHERE id = 'fr-005'"
```

## 5. Vérification
```bash
curl -s "https://api.rawiaudio.com/episodes/fr-005" | head -c 300; echo
curl -s "https://api.rawiaudio.com/episodes/fr-005/audio" | head -c 120; echo
```
- La fiche doit contenir les sources.
- La deuxième commande doit renvoyer une URL : ouvrir l'épisode dans l'appli et l'écouter quelques secondes.

## Épisodes 1 à 4
`ops/episodes/0001-episodes-1-a-4.sql` les crée non publiés (étape 2), d'après le site.
- Audio sur R2 au 26/10/2026 : épisodes 1, 2 et 3. Épisode 4 : choisir entre `younous_ep_4.mp3` (128 kbit/s, mono) et `younous_ep_4_ambiance.mp3` (192 kbit/s, stéréo, à réencoder).
- Restent les étapes 3 et 4 pour chacun, avec les fiches du studio.
