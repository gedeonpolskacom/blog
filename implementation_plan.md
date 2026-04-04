# Implementation Plan - Remaining Work

Status date: 2026-04-01

## Scope
This plan tracks only items that are still open or partially open after the latest code rollout.

## Current Snapshot

Completed:
- Admin auth (`src/proxy.ts`, `/admin/login`, cookie flow, API 401 on `/api/admin/*`)
- Topics preview links after generation
- Scheduled publish cron endpoint
- Scheduled newsletter cron endpoint
- Dynamic sitemap
- `/nowosci` fed by real B2B API
- Blog pagination (Prev/Next)
- B2B-based cover and gallery fallback plumbing
- Real trends suggestions in `GET /api/ai/generate-article` via SerpAPI (with static fallback + server cache)
- Newsletter export endpoint `GET/POST /api/newsletter/export` (CSV + Mailchimp/Brevo connectors)

Partially completed:
- Live verification run of `increment_views` on a real published article (diagnostic endpoint ready)

Not started:
- (none in this phase; next work is polish/optimization)

## Phase 1 - Database alignment (P0) [COMPLETED]

Goal: remove runtime schema drift and make API behavior deterministic.

Tasks:
1. Apply SQL migrations on the target Supabase project:
   - `20260331_pim_sync_unique.sql`
   - `20260401_topic_suggestions_idempotency.sql`
   - `20260401_cover_image_column.sql`
   - `20260401_gallery_images_column.sql`
2. Validate:
   - `articles.gallery_images` exists
   - `articles.cover_image` exists
   - `topic_suggestions_source_title_key` exists
   - `pim_sync_log_product_sku_key` exists
3. Smoke-check API routes:
   - `POST /api/ai/generate-article` (save draft)
   - `GET /api/articles`
   - `GET /api/articles/gallery?slug=...`

Exit criteria:
- No `PGRST204` schema-cache errors.
- New drafts persist cover + gallery without fallback failure.

Verification result (2026-04-01):
- `/api/admin/diagnostics/db` returned `overall: ok`
- `articles.cover_image` and `articles.gallery_images` present
- `topic_suggestions` and `pim_sync_log` uniqueness checks passed
- `increment_views` RPC check passed

## Phase 2 - Image model unification (P1)

Goal: make `cover_image` the single canonical field in app code while keeping backward compatibility during transition.

Tasks:
1. Update read paths to prefer `cover_image` first everywhere.
2. Update write paths (`PATCH /api/admin/articles`, AI draft insert, sync insert) to write both temporarily:
   - `cover_image` canonical
   - `cover_url` compatibility
3. Add one cleanup migration once verified:
   - optional sync/backfill from `cover_url` to `cover_image`
   - optional deprecation decision for `cover_url`

Exit criteria:
- UI/API works if only `cover_image` is present.
- No broken images for old records.

Progress update (2026-04-01):
- Added shared resolver `src/lib/article-cover.ts` and replaced repeated `cover_image ?? cover_url` mappings.
- Added migration `supabase/migrations/20260401_cover_image_backfill.sql` to align historical rows.
- Kept backward-compatible writes (`cover_image` + `cover_url`) to avoid regressions during transition.

## Phase 3 - Visual polish and gallery UX (P1)

Goal: improve hero quality and use additional product photos consistently.

Tasks:
1. Add 2-3 deterministic hero variants (based on slug hash/category):
   - split media + text
   - centered product spotlight
   - wide product + thumbnail strip
2. Ensure card and hero image rendering keeps full product visibility (`contain` first).
3. Keep gallery section visible when `gallery_images.length > 1` and improve spacing on mobile.
4. Track fallback coverage:
   - strict SKU probe
   - product page scrape
   - DB gallery cache

Exit criteria:
- Hero no longer crops critical product area.
- Published article with multi-photo SKU shows gallery.

Progress update (2026-04-01):
- Improved B2B gallery resolution in `src/lib/b2b-images.ts`:
  - strict SKU resolution based on product existence,
  - sibling image probing based on canonical `products.image_url` root,
  - product-page scrape fallback now works even if filenames do not include SKU.
- Implemented 3 deterministic visual variants in `src/app/blog/[slug]/BlogPostClient.tsx`:
  - variant-aware hero composition (`hero-stage-v0/v1/v2`),
  - variant-aware article layout columns,
  - variant-aware gallery grids (`article-gallery-v0/v1/v2`).

## Phase 4 - Functional backlog (P2)

Tasks:
1. Validate `increment_views` in live DB with before/after checks (`POST /api/admin/diagnostics/views-live`).

Exit criteria:
- Analytics confirmed.

## Operational Checklist

- Env vars configured:
  - `B2B_XML_URL`
  - `B2B_API_BASE` (optional, default: `https://www.b2b.gedeonpolska.com`)
  - `B2B_API_KEY`
  - `B2B_CLIENT_ID`
  - `ADMIN_TOKEN`
  - `CRON_SECRET`
  - `GEMINI_API_KEY`
  - `SERPAPI_API_KEY` (optional, enables dynamic trend suggestions)
  - `MAILCHIMP_API_KEY` + `MAILCHIMP_AUDIENCE_ID` (optional for Mailchimp export)
  - `BREVO_API_KEY` + `BREVO_LIST_ID` (optional for Brevo export)
  - Supabase URL + keys
- Vercel cron entries present for:
  - `/api/b2b/sync`
  - `/api/cron/publish-scheduled`
  - `/api/cron/send-newsletters`
