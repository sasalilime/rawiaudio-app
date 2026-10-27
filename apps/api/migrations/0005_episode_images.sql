-- Illustration d'un épisode (ADR-0009) : clé de l'objet dans le bucket public rawi-images, NULL sans illustration.
-- Même dossier que l'audio : <langue>/<numéro sur 3 chiffres>-<slug>/<fichier>.webp.
-- La clé doit être celle de l'épisode lui-même : pas d'image d'un autre épisode par erreur.
-- Une image publiée ne change jamais (cache d'un an) : la remplacer, c'est en déposer une sous une nouvelle clé.
ALTER TABLE episodes ADD COLUMN image_key text
    CHECK (image_key ~ ('^' || lang || '/' || lpad(number::text, 3, '0') || '-' || slug || '/[a-z0-9]+(-[a-z0-9]+)*\.webp$'));
