-- ── NEWSLETTER JOBS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS newsletter_jobs (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name              TEXT,
  subject           TEXT NOT NULL,
  html_content      TEXT NOT NULL,
  sender_name       TEXT DEFAULT 'GEDEON',
  sender_email      TEXT DEFAULT 'newsletter@gedeonpolska.com',
  sender_account_id TEXT,
  status            TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'partial', 'failed')),
  scheduled_at      TIMESTAMPTZ,
  sent_at           TIMESTAMPTZ,
  recipients        JSONB DEFAULT '[]',
  recipients_count  INTEGER DEFAULT 0,
  results           JSONB DEFAULT '[]',
  config            JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (idempotent)
DO $$ BEGIN
  ALTER TABLE newsletter_jobs ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Policy: service_role only (anon blocked by default)
DROP POLICY IF EXISTS "Newsletter jobs service only" ON newsletter_jobs;
