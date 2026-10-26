-- Catalogue en lecture : séries, épisodes et leurs sources.

CREATE TABLE series (
    id    text PRIMARY KEY, -- identifiant public : <langue>-<slug>, ex. fr-al-kahf
    lang  text NOT NULL CHECK (lang IN ('fr', 'ar', 'en')),
    title text NOT NULL
);

CREATE TABLE episodes (
    -- Identifiant public immuable (URLs, cache hors ligne) : <langue>-<numéro sur 3 chiffres>, ex. fr-001.
    id               text PRIMARY KEY,
    lang             text NOT NULL CHECK (lang IN ('fr', 'ar', 'en')),
    number           integer NOT NULL CHECK (number > 0),
    slug             text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    title            text NOT NULL,
    reference        text NOT NULL, -- référence coranique affichée telle quelle
    duration_seconds integer NOT NULL CHECK (duration_seconds > 0),
    published_at     timestamptz,   -- NULL ou dans le futur : invisible dans l'API
    summary          text[] NOT NULL DEFAULT '{}', -- paragraphes recopiés de la fiche validée du studio
    series_id        text REFERENCES series (id),
    UNIQUE (lang, number),
    UNIQUE (lang, slug),
    -- ponytail: numéro sur 3 chiffres ; lpad tronque au-delà de 999, l'insertion échouera alors ici.
    CHECK (id = lang || '-' || lpad(number::text, 3, '0'))
);

CREATE TABLE episode_sources (
    episode_id text NOT NULL REFERENCES episodes (id) ON DELETE CASCADE,
    position   integer NOT NULL CHECK (position > 0), -- ordre d'affichage
    label      text NOT NULL, -- livre, tome et page, affichés tels quels
    -- Shamela uniquement : seules sources admises par le studio (studio/docs/sources.md).
    url        text NOT NULL CHECK (url ~ '^https://shamela\.ws/book/[0-9]+(/[0-9]+)?$'),
    PRIMARY KEY (episode_id, position)
);
