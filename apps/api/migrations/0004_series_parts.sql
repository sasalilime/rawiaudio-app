-- Une série est une histoire en plusieurs parties (environ 5 min chacune), écoutées dans l'ordre (ADR-0007).

ALTER TABLE episodes ADD COLUMN series_part integer CHECK (series_part > 0);

-- Les épisodes déjà rattachés à une série reçoivent un numéro de partie, dans l'ordre de leur numéro.
UPDATE episodes e
SET series_part = numbered.part
FROM (
    SELECT id, row_number() OVER (PARTITION BY series_id ORDER BY number) AS part
    FROM episodes
    WHERE series_id IS NOT NULL
) numbered
WHERE e.id = numbered.id;

ALTER TABLE episodes
    -- Une partie seulement dans une série, et toujours une partie dans une série.
    ADD CONSTRAINT episodes_series_part_required CHECK ((series_id IS NULL) = (series_part IS NULL)),
    ADD CONSTRAINT episodes_series_part_key UNIQUE (series_id, series_part);

-- Comme pour les thèmes : un épisode français ne peut pas entrer dans une série arabe.
ALTER TABLE series ADD CONSTRAINT series_id_lang_key UNIQUE (id, lang);
ALTER TABLE episodes ADD CONSTRAINT episodes_series_lang_fkey
    FOREIGN KEY (series_id, lang) REFERENCES series (id, lang);
