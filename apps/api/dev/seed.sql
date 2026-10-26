-- Données de développement uniquement, jamais en production. Rejouable : vide le catalogue d'abord.
-- Prérequis : l'API a démarré une fois (migrations appliquées). Depuis apps/api :
--   docker compose exec -T db psql -U rawi -d rawi -v ON_ERROR_STOP=1 < dev/seed.sql
-- Pas de résumé : il se recopie de la fiche validée du studio, jamais rédigé ailleurs.
BEGIN;

TRUNCATE episode_themes, themes, episode_sources, episodes, series;

INSERT INTO episodes (id, lang, number, slug, title, reference, duration_seconds, published_at, series_id) VALUES
    ('fr-001', 'fr', 1, 'les-gens-de-la-caverne', 'Les Gens de la Caverne',
     'Sourate Al-Kahf, versets 9 à 26', 392, '2026-10-16 00:00:00+00', NULL),
    -- Programmé loin dans le futur : doit rester invisible (liste et détail). Durée fictive.
    ('fr-002', 'fr', 2, 'l-homme-aux-deux-jardins', 'L''homme aux deux jardins',
     'Sourate Al-Kahf, versets 32 à 44', 420, '2099-01-01 00:00:00+00', NULL);

-- Lien de la matrice du studio (livre seul, sans page) : la vraie source vient de la fiche de l'épisode.
INSERT INTO episode_sources (episode_id, position, label, url) VALUES
    ('fr-001', 1, 'تفسير السعدي (تيسير الكريم الرحمن)', 'https://shamela.ws/book/42');

-- Thèmes : mêmes noms qu'en production (ops/episodes/0002-themes.sql), en plus court.
INSERT INTO themes (id, lang, slug, title, position) VALUES
    ('fr-histoires-du-coran', 'fr', 'histoires-du-coran', 'Histoires du Coran', 1),
    ('fr-prophetes', 'fr', 'prophetes', 'Les prophètes', 2);
INSERT INTO episode_themes (episode_id, theme_id, lang) VALUES
    ('fr-001', 'fr-histoires-du-coran', 'fr'),
    ('fr-002', 'fr-histoires-du-coran', 'fr');

COMMIT;
