-- Make topic_suggestions idempotent for PIM sync runs.
-- 1) Remove duplicate rows by (source, title_pl), keeping the oldest.
-- 2) Enforce uniqueness at DB level to prevent re-growth.

DELETE FROM topic_suggestions ts
USING topic_suggestions d
WHERE ts.id > d.id
  AND ts.source = d.source
  AND ts.title_pl = d.title_pl;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'topic_suggestions_source_title_key'
  ) THEN
    ALTER TABLE topic_suggestions
      ADD CONSTRAINT topic_suggestions_source_title_key UNIQUE (source, title_pl);
  END IF;
END $$;
