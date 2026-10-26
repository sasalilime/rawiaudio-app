-- Rangement du catalogue par thème : plusieurs thèmes par épisode, un ordre d'affichage par langue.

CREATE TABLE themes (
    id       text PRIMARY KEY, -- identifiant public : <langue>-<slug>, ex. fr-prophetes
    lang     text NOT NULL CHECK (lang IN ('fr', 'ar', 'en')),
    slug     text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    title    text NOT NULL,
    position integer NOT NULL CHECK (position > 0), -- ordre d'affichage dans le catalogue
    UNIQUE (lang, slug),
    UNIQUE (lang, position),
    UNIQUE (id, lang), -- cible des clés étrangères de episode_themes
    CHECK (id = lang || '-' || slug)
);

-- Cible des clés étrangères de episode_themes (id est déjà unique : la paire l'est aussi).
ALTER TABLE episodes ADD CONSTRAINT episodes_id_lang_key UNIQUE (id, lang);

CREATE TABLE episode_themes (
    episode_id text NOT NULL,
    theme_id   text NOT NULL,
    -- La même langue des deux côtés : un épisode français ne peut pas entrer dans un thème arabe.
    lang       text NOT NULL,
    PRIMARY KEY (episode_id, theme_id),
    FOREIGN KEY (episode_id, lang) REFERENCES episodes (id, lang) ON DELETE CASCADE,
    FOREIGN KEY (theme_id, lang) REFERENCES themes (id, lang) ON DELETE CASCADE
);
