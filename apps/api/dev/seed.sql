-- Données de développement uniquement, jamais en production. Rejouable : vide le catalogue d'abord.
-- Prérequis : l'API a démarré une fois (migrations appliquées). Depuis apps/api :
--   docker compose exec -T db psql -U rawi -d rawi -v ON_ERROR_STOP=1 < dev/seed.sql
-- Pas de résumé : il se recopie de la fiche validée du studio, jamais rédigé ailleurs.
BEGIN;

TRUNCATE episode_sources, episodes, series;

INSERT INTO series (id, lang, title) VALUES
    ('fr-al-kahf', 'fr', 'Les histoires d''Al-Kahf');

INSERT INTO episodes (id, lang, number, slug, title, reference, duration_seconds, published_at, series_id) VALUES
    ('fr-001', 'fr', 1, 'les-gens-de-la-caverne', 'Les Gens de la Caverne',
     'Sourate Al-Kahf, versets 9 à 26', 392, '2026-10-16 00:00:00+00', 'fr-al-kahf'),
    -- Programmé loin dans le futur : doit rester invisible (liste et détail). Durée fictive.
    ('fr-002', 'fr', 2, 'l-homme-aux-deux-jardins', 'L''homme aux deux jardins',
     'Sourate Al-Kahf, versets 32 à 44', 420, '2099-01-01 00:00:00+00', 'fr-al-kahf');

-- Lien de la matrice du studio (livre seul, sans page) : la vraie source vient de la fiche de l'épisode.
INSERT INTO episode_sources (episode_id, position, label, url) VALUES
    ('fr-001', 1, 'تفسير السعدي (تيسير الكريم الرحمن)', 'https://shamela.ws/book/42');

COMMIT;
