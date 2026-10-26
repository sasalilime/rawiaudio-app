-- Épisodes 1 à 4, saisis NON publiés (published_at vide) : sources et résumé d'abord, publication ensuite.
-- Procédure : ops/runbooks/publier-un-episode.md. Données reprises de rawiaudio-site (src/content/episodes.ts),
-- durées mesurées sur les fichiers audio (ffprobe), arrondies à la seconde.
BEGIN;

INSERT INTO series (id, lang, title) VALUES
    ('fr-al-kahf', 'fr', 'Les histoires d''Al-Kahf')
ON CONFLICT (id) DO NOTHING;

INSERT INTO episodes (id, lang, number, slug, title, reference, duration_seconds, series_id) VALUES
    ('fr-001', 'fr', 1, 'les-gens-de-la-caverne', 'Les Gens de la Caverne',
     'Sourate Al-Kahf, versets 9 à 26', 392, 'fr-al-kahf'),
    ('fr-002', 'fr', 2, 'l-homme-aux-deux-jardins', 'L''homme aux deux jardins',
     'Sourate Al-Kahf, versets 32 à 44', 351, 'fr-al-kahf'),
    ('fr-003', 'fr', 3, 'l-homme-que-la-terre-a-englouti', 'L''homme que la terre a englouti',
     'Sourate Al-Qasas, versets 76 à 83', 351, NULL),
    ('fr-004', 'fr', 4, 'avale-par-un-enorme-poisson', 'Avalé par un énorme poisson',
     'Sourate As-Saffat, versets 139 à 148, et sourate Al-Anbiya, versets 87 et 88', 258, NULL);

COMMIT;
