ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS gallery_images TEXT[];

