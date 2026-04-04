-- Add canonical cover_image column and backfill from legacy cover_url.
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS cover_image TEXT;

UPDATE public.articles
SET cover_image = cover_url
WHERE cover_image IS NULL
  AND cover_url IS NOT NULL;

