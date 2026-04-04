-- Migration: Add UNIQUE constraint to pim_sync_log.product_sku
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Remove duplicate rows (keep the one with article_id if exists, else first)
DELETE FROM pim_sync_log
WHERE id NOT IN (
  SELECT DISTINCT ON (product_sku) id
  FROM pim_sync_log
  ORDER BY product_sku, article_id NULLS LAST, created_at ASC
);

-- 2. Add UNIQUE constraint
ALTER TABLE pim_sync_log
  ADD CONSTRAINT pim_sync_log_product_sku_key UNIQUE (product_sku);

-- 3. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_pim_sync_sku ON pim_sync_log(product_sku);
CREATE INDEX IF NOT EXISTS idx_topics_source_status ON topic_suggestions(source, status);

-- 4. Clean up duplicate topic_suggestions from pim_trigger
-- (keeps the earliest entry per product title)
DELETE FROM topic_suggestions
WHERE id NOT IN (
  SELECT DISTINCT ON (title_pl) id
  FROM topic_suggestions
  ORDER BY title_pl, created_at ASC
)
AND source = 'pim_trigger';

-- Verify
SELECT 
  (SELECT COUNT(*) FROM pim_sync_log) AS pim_sync_count,
  (SELECT COUNT(*) FROM topic_suggestions) AS topics_count,
  (SELECT COUNT(DISTINCT product_sku) FROM pim_sync_log) AS unique_skus;
