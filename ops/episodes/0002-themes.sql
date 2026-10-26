-- Les thèmes du catalogue et le rattachement des épisodes 1 à 4 (après 0001).
-- Base : les thèmes de rawiaudio-studio (studio/docs/sources.md), avec des noms simplifiés pour les familles.
-- Validé par Salim le 26/10/2026 : sans « Les anges », avec « Les dynasties » (pas encore de sources dans la matrice
-- du studio : à y ajouter avant d'écrire ces épisodes). Un nom se change par un simple UPDATE.
-- Un thème sans épisode publié n'apparaît pas dans l'appli.
BEGIN;

INSERT INTO themes (id, lang, slug, title, position) VALUES
    ('fr-histoires-du-coran', 'fr', 'histoires-du-coran', 'Histoires du Coran', 1),
    ('fr-prophetes', 'fr', 'prophetes', 'Les prophètes', 2),
    ('fr-noms-d-allah', 'fr', 'noms-d-allah', 'Les noms d''Allah', 3),
    ('fr-vie-apres-la-mort', 'fr', 'vie-apres-la-mort', 'La vie après la mort', 4),
    ('fr-compagnons', 'fr', 'compagnons', 'Les compagnons', 5),
    ('fr-recits-du-prophete', 'fr', 'recits-du-prophete', 'Récits du Prophète ﷺ', 6),
    ('fr-vie-du-prophete', 'fr', 'vie-du-prophete', 'La vie du Prophète ﷺ', 7),
    ('fr-califes', 'fr', 'califes', 'Les califes bien guidés', 8),
    ('fr-dynasties', 'fr', 'dynasties', 'Les dynasties', 9),
    ('fr-savants', 'fr', 'savants', 'Les savants', 10);

-- Yunus relève aussi des prophètes ; les trois autres sont des histoires du Coran seulement.
INSERT INTO episode_themes (episode_id, theme_id, lang) VALUES
    ('fr-001', 'fr-histoires-du-coran', 'fr'),
    ('fr-002', 'fr-histoires-du-coran', 'fr'),
    ('fr-003', 'fr-histoires-du-coran', 'fr'),
    ('fr-004', 'fr-histoires-du-coran', 'fr'),
    ('fr-004', 'fr-prophetes', 'fr');

COMMIT;
