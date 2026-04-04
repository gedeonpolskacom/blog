-- Backfill canonical cover_image from legacy cover_url and keep both columns aligned for old rows.

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS cover_image text;

UPDATE articles
SET cover_image = cover_url
WHERE cover_image IS NULL
  AND cover_url IS NOT NULL;

UPDATE articles
SET cover_url = cover_image
WHERE cover_url IS NULL
  AND cover_image IS NOT NULL;
