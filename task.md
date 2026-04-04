# Plan implementacji - blog.gedeonpolska.com

Status: 2026-04-01

## Zrobione

### Krytyczne
- [x] Dynamiczny sitemap (`src/app/sitemap.ts`) pobiera slugi z Supabase.
- [x] Strona `/nowosci` pobiera realne dane z `/api/b2b/products`.
- [x] Admin auth przez `src/proxy.ts` + cookie `admin_token` + login page (`/admin/login`).
- [x] SEO OG/meta dla wpisu blogowego (`generateMetadata` w `src/app/blog/[slug]/page.tsx`).

### Wazne
- [x] Link podgladu po generowaniu tematu (`/blog/[slug]?preview=1`) w panelu Topics.
- [x] Cron auto-publikacji: `POST /api/cron/publish-scheduled` (Bearer `CRON_SECRET`).
- [x] Cron auto-wysylki newsletterow: `POST /api/cron/send-newsletters`.
- [x] Podstawowa paginacja bloga (Prev/Next) na `/blog`.
- [x] Dedup tematow przy sync (upsert + unikalnosc po `source,title_pl` w migracji).
- [x] Sugestie tematow z trendow: `GET /api/ai/generate-article` korzysta z SerpAPI (z fallbackiem statycznym i cache 6h).
- [x] Eksport newslettera: `GET/POST /api/newsletter/export` (CSV + integracja Mailchimp/Brevo).

### Cover/Galeria
- [x] Auto-cover dla draftow AI z obrazow B2B (detekcja SKU, probe URL, fallbacki).
- [x] Reczne pole `cover_image` w panelu Drafts (zapis przez `PATCH /api/admin/articles`).
- [x] Publiczny endpoint dogrywania galerii: `GET /api/articles/gallery?slug=...`.
- [x] Podstawowa galeria na stronie artykulu (jesli `gallery_images.length > 1`).

## Czescowo zrobione

- [~] Weryfikacja live views wymaga jednego triggera na produkcyjnym wpisie (endpoint diagnostyczny gotowy).

## Do zrobienia (priorytet)

### P0 - infrastruktura/DB
- [x] Uruchomic migracje Supabase na aktywnym projekcie:
  - `supabase/migrations/20260331_pim_sync_unique.sql`
  - `supabase/migrations/20260401_topic_suggestions_idempotency.sql`
  - `supabase/migrations/20260401_cover_image_column.sql`
  - `supabase/migrations/20260401_gallery_images_column.sql`
- [x] Potwierdzic diagnostyka DB (`/api/admin/diagnostics/db`): kolumny + constrainty + `increment_views` = `overall: ok`.

### P1 - funkcje biznesowe
- [~] Zweryfikowac live `increment_views` (RPC i wzrost `articles.views` po wejsciach) przez `POST /api/admin/diagnostics/views-live`.
- [x] Zrobic finalna unifikacje na `cover_image` (odczyt/zapis + migracja kompatybilnosci).
- [x] Ustabilizowac wybor galerii B2B dla SKU z nietypowymi nazwami plikow (strict SKU resolve + fallback po `products.image_url` i stronie produktu).

### P2 - roadmap
- [x] Dopracowac system wariantow layoutu artykulow (3 stale uklady hero + sekcji + warianty galerii).

## Zmienne srodowiskowe (wymagane)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `B2B_XML_URL`
- `B2B_API_KEY`
- `B2B_CLIENT_ID`
- `B2B_API_BASE` (opcjonalnie, domyślnie `https://www.b2b.gedeonpolska.com`)
- `GEMINI_API_KEY`
- `ADMIN_TOKEN`
- `CRON_SECRET`

Opcjonalne:
- `PEXELS_API_KEY` / `PEXELS_ACCESS_KEY` / `PEXEL_ACCESS_KEY` (stockowe obrazy dla artykulow bez mocnego SKU)
- `GEMINI_USE_PRO_FOR_COMPLEX` (`true/1` aby wlaczyc drozszy model Pro dla `multi` i `product`; domyslnie Flash)
- `SERPAPI_API_KEY` lub `SERPAPI_KEY` (wlacza dynamiczne sugestie trendow; bez klucza endpoint wraca do listy statycznej)
- `MAILCHIMP_API_KEY`, `MAILCHIMP_AUDIENCE_ID` (dla eksportu do Mailchimp)
- `BREVO_API_KEY`, `BREVO_LIST_ID` (dla eksportu do Brevo)

## Szybka checklista po deployu

1. Wejscie na `/admin` bez cookie przekierowuje na `/admin/login`.
2. `GET /api/admin/articles` bez cookie zwraca `401`.
3. Wygenerowany draft ma poprawny `cover_image` i dziala `?preview=1`.
4. `/api/cron/publish-scheduled` publikuje wpisy z `scheduled_for <= now`.
5. `/blog` pokazuje karty z obrazem i dzialajaca paginacja.
6. `POST /api/admin/diagnostics/views-live` zwraca `delta >= 1` dla testowego artykulu.
