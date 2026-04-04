-- ============================================================
-- Gedeon Polska Blog — Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── ARTICLES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS articles (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,
  title_pl      TEXT NOT NULL,
  title_en      TEXT,
  excerpt_pl    TEXT,
  excerpt_en    TEXT,
  content_pl    JSONB,         -- Rich content blocks array
  content_en    JSONB,
  category      TEXT NOT NULL,
  tags          TEXT[],
  cover_color   TEXT,          -- CSS gradient string
  cover_image   TEXT,          -- External URL (Unsplash/manual)
  gallery_images TEXT[],       -- Additional product images for gallery
  author        TEXT DEFAULT 'Zespół Gedeon',
  author_role   TEXT DEFAULT 'Dział Marketingu',
  read_time     INTEGER,       -- minutes
  status        TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
  published_at  TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  source        TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'ai_generated', 'pim_trigger')),
  seo_title_pl  TEXT,
  seo_desc_pl   TEXT,
  seo_title_en  TEXT,
  seo_desc_en   TEXT,
  views         INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── PRODUCTS (linked from B2B catalog) ───────────────────────
CREATE TABLE IF NOT EXISTS products (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sku           TEXT UNIQUE NOT NULL,            -- B2B symbol, e.g. DBCL50LINEN
  name          TEXT NOT NULL,
  name_en       TEXT,
  description   TEXT,
  description_en TEXT,
  category      TEXT,
  b2b_url       TEXT,                           -- Link to b2b.gedeonpolska.com
  shopify_handle TEXT,                          -- Shopify product handle
  image_url     TEXT,
  price_range   TEXT,                           -- e.g. "25-40 PLN"
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── ARTICLE <-> PRODUCT links ────────────────────────────────
CREATE TABLE IF NOT EXISTS article_products (
  article_id    UUID REFERENCES articles(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES products(id) ON DELETE CASCADE,
  position      INTEGER DEFAULT 0,              -- order in sidebar
  PRIMARY KEY (article_id, product_id)
);

-- ── INSPIRATION PHOTOS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inspiration_photos (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title         TEXT,
  title_en      TEXT,
  tag           TEXT NOT NULL,                  -- albumy, ramki, media, studio
  storage_path  TEXT,                           -- Supabase Storage path
  url           TEXT,                           -- Public URL
  display_from  TIMESTAMPTZ DEFAULT NOW(),      -- Schedule: show from date
  display_until TIMESTAMPTZ,                    -- Optional: hide after this date
  is_active     BOOLEAN DEFAULT true,
  sort_order    INTEGER DEFAULT 0,
  aspect_ratio  TEXT DEFAULT '4/3',
  linked_product_id UUID REFERENCES products(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── NEWSLETTER SUBSCRIBERS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  lang          TEXT DEFAULT 'pl' CHECK (lang IN ('pl', 'en')),
  source        TEXT DEFAULT 'blog',            -- where they signed up
  confirmed     BOOLEAN DEFAULT false,
  unsubscribed  BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── AI TOPIC SUGGESTIONS ───────────────────────────────────── 
CREATE TABLE IF NOT EXISTS topic_suggestions (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title_pl      TEXT NOT NULL,
  title_en      TEXT,
  category      TEXT,
  keywords      TEXT[],
  search_volume INTEGER,
  difficulty    INTEGER,                        -- 1-10
  source        TEXT,                          -- google_trends, serpapi, manual
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'generated')),
  article_id    UUID REFERENCES articles(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── SCHEDULED PUBLICATIONS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS publication_schedule (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  article_id    UUID REFERENCES articles(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  channels      TEXT[],                         -- blog, newsletter, facebook, instagram
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed', 'cancelled')),
  published_at  TIMESTAMPTZ,
  error         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── PIM SYNC LOG ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pim_sync_log (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_sku   TEXT UNIQUE,                        -- UNIQUE: one log row per SKU
  event_type    TEXT,                           -- new_product, price_change, stock_change
  payload       JSONB,
  processed     BOOLEAN DEFAULT false,
  article_id    UUID REFERENCES articles(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDEXES ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_photos_tag ON inspiration_photos(tag);
CREATE INDEX IF NOT EXISTS idx_pim_sync_sku ON pim_sync_log(product_sku);
CREATE INDEX IF NOT EXISTS idx_topics_source_status ON topic_suggestions(source, status);
CREATE INDEX IF NOT EXISTS idx_photos_active ON inspiration_photos(is_active, display_from);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
ALTER TABLE articles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspiration_photos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products              ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_products      ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_suggestions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE publication_schedule  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pim_sync_log          ENABLE ROW LEVEL SECURITY;

-- Public can read published articles
CREATE POLICY "Published articles are public" ON articles
  FOR SELECT USING (status = 'published');

-- Public can read active inspiration photos
CREATE POLICY "Active photos are public" ON inspiration_photos
  FOR SELECT USING (is_active = true AND display_from <= NOW());

-- Public can read the product catalog (used in article sidebars)
CREATE POLICY "Products are public" ON products
  FOR SELECT USING (is_active = true);

-- Public can read article-product links (for sidebars)
CREATE POLICY "Article products are public" ON article_products
  FOR SELECT USING (true);

-- topic_suggestions, publication_schedule, pim_sync_log:
-- No public policy = anon key blocked; service_role bypasses RLS (admin only)

-- Newsletter: restrict INSERT to valid email format (avoids "always true" warning)
CREATE POLICY "Anyone can subscribe" ON newsletter_subscribers
  FOR INSERT WITH CHECK (email ~ '^[^@]+@[^@]+\.[^@]+$');

-- ── HELPER FUNCTIONS ─────────────────────────────────────────
-- Update updated_at automatically
-- SET search_path = '' fixes "Function Search Path Mutable" warning
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── HELPER: increment article views (callable via supabase.rpc) ──
CREATE OR REPLACE FUNCTION increment_views(article_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.articles SET views = views + 1 WHERE id = article_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ── SEED DATA ─────────────────────────────────────────────────
INSERT INTO products (sku, name, name_en, category, b2b_url) VALUES
  ('DBCL50LINEN', 'Album Lniany DBCL50', 'Linen Album DBCL50', 'albumy', 'https://b2b.gedeonpolska.com/pl/albumy'),
  ('PB30', 'Ramka Drewniana PB30', 'Wooden Frame PB30', 'ramki', 'https://b2b.gedeonpolska.com/pl/drewniane'),
  ('DRYLAB-PRO', 'DryLab Media Pro Roll', 'DryLab Media Pro Roll', 'media', 'https://b2b.gedeonpolska.com/pl/drylab-media'),
  ('KODAK-GLOSSY-10X15', 'Papier KODAK Glossy 10x15', 'KODAK Glossy Paper 10x15', 'media', 'https://b2b.gedeonpolska.com/pl/papier-fotograficzny')
ON CONFLICT (sku) DO NOTHING;
