/**
 * PIM Auto-Sync — Cron Job
 * Route: GET /api/b2b/sync
 *
 * Called hourly by Vercel Cron.
 * Fetches B2B XML Feed, detects new products,
 * writes to pim_sync_log + topic_suggestions,
 * and optionally auto-generates Gemini drafts (?autoDraft=true).
 *
 * Security: Vercel Cron sends Authorization: Bearer <CRON_SECRET>
 * Set CRON_SECRET in Vercel env vars + .env.local
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const B2B_XML_URL = process.env.B2B_XML_URL ?? '';

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// Max Gemini drafts per cron run (preview models: stricter rate limits — keep ≤ 3)
const MAX_DRAFTS_PER_RUN = 3;

// ── Types ─────────────────────────────────────────────────────

interface B2BProduct {
  id: string;
  sku: string;
  name: string;
  description: string;
  url: string;
  categories: string[];
  priceNet: number;
  inStock: boolean;
  images: string[];
}

interface SyncResult {
  fetched: number;
  newProducts: number;
  productsUpserted: number;
  topicsCreated: number;
  draftsCreated: number;
  errors: string[];
}

type ProductUpsertRow = {
  sku: string;
  name: string;
  description: string;
  category: string;
  b2b_url: string;
  image_url: string | null;
  is_active: boolean;
};

type TopicInsertRow = {
  title_pl: string;
  title_en: string;
  category: string;
  keywords: string[];
  source: 'pim_trigger';
  status: 'pending';
};

function choosePrimaryB2BImage(images: string[]): string | null {
  if (!images.length) return null;

  // Prefer base file without sequence suffix (_2, _3, _4...) when available.
  const primary = images.find((url) => !/_\d+\.(jpe?g|png|webp)$/i.test(url));
  if (primary) return primary;

  // Otherwise pick the earliest sequence index.
  const sorted = [...images].sort((a, b) => {
    const aMatch = a.match(/_(\d+)\.(jpe?g|png|webp)$/i);
    const bMatch = b.match(/_(\d+)\.(jpe?g|png|webp)$/i);
    const aNum = aMatch ? Number.parseInt(aMatch[1], 10) : 999;
    const bNum = bMatch ? Number.parseInt(bMatch[1], 10) : 999;
    return aNum - bNum;
  });
  return sorted[0] ?? null;
}

function chooseGalleryB2BImages(images: string[], max = 6): string[] {
  if (!images.length) return [];
  const unique = Array.from(new Set(images));
  const sorted = [...unique].sort((a, b) => {
    const aMatch = a.match(/_(\d+)\.(jpe?g|png|webp)$/i);
    const bMatch = b.match(/_(\d+)\.(jpe?g|png|webp)$/i);
    const aNum = aMatch ? Number.parseInt(aMatch[1], 10) : 0;
    const bNum = bMatch ? Number.parseInt(bMatch[1], 10) : 0;
    return aNum - bNum;
  });
  return sorted.slice(0, max);
}

function normalizeSku(sku: string) {
  return sku.trim().toUpperCase();
}

// ── Auth ──────────────────────────────────────────────────────

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  // Dev mode: skip auth when CRON_SECRET is not configured
  if (!cronSecret) return true;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${cronSecret}`;
}

// ── XML parser ────────────────────────────────────────────────

function parseXmlProducts(xmlText: string): B2BProduct[] {
  const products: B2BProduct[] = [];
  const productMatches = xmlText.matchAll(/<product[^>]*>([\s\S]*?)<\/product>/g);

  for (const match of productMatches) {
    const block = match[1];
    const get = (tag: string) =>
      block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\/${tag}>`))?.[1]
      ?? block.match(new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`))?.[1]
      ?? '';

    const photosSet = new Set<string>();
    for (const p of block.matchAll(/<photo[^>]*url=["']([^"']+)["']/gi)) {
      photosSet.add(p[1].replaceAll('&amp;', '&'));
    }
    // Fallback: capture any direct B2B asset URL found in the product block.
    for (const p of block.matchAll(/https?:\/\/(?:www\.)?b2b\.gedeonpolska\.com\/zasoby\/import\/[^\s<>"']+\.(?:jpe?g|png|webp)/gi)) {
      photosSet.add(p[0].replaceAll('&amp;', '&'));
    }
    const photos = Array.from(photosSet);

    // Parse categories — each <category> has CDATA content
    const cats: string[] = [];
    for (const c of block.matchAll(/<category[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/category>/g)) {
      cats.push(c[1]);
    }

    const product: B2BProduct = {
      id: get('id'),
      sku: get('sku'),
      name: get('name'),
      description: get('desc'),
      url: get('url'),
      categories: cats,
      priceNet: parseFloat(get('priceAfterDiscountNet')) || 0,
      inStock: get('inStock').toLowerCase() === 'true',
      images: photos,
    };

    if (product.sku && product.name) {
      product.sku = normalizeSku(product.sku);
      products.push(product);
    }
  }

  return products;
}

async function dedupeTopicRows(topicRows: TopicInsertRow[]) {
  if (!topicRows.length) return [] as TopicInsertRow[];

  const uniqueByTitle = new Map<string, TopicInsertRow>();
  for (const row of topicRows) {
    const title = row.title_pl?.trim();
    if (!title) continue;
    if (!uniqueByTitle.has(title)) {
      uniqueByTitle.set(title, { ...row, title_pl: title });
    }
  }

  // Deduplikację względem istniejących rekordów robi UNIQUE(source,title_pl)
  // + upsert(ignoreDuplicates), co jest bardziej niezawodne dla dużych batchy.
  return Array.from(uniqueByTitle.values());
}

// ── Category mapper ───────────────────────────────────────────

function mapCategory(cats: string[]): string {
  const s = cats.join(' ').toLowerCase();
  if (s.includes('album')) return 'Albumy';
  if (s.includes('ramk') || s.includes('antyram')) return 'Ramki';
  if (s.includes('drylab') || s.includes('media')) return 'Media';
  if (s.includes('kodak') || s.includes('papier')) return 'KODAK';
  return 'Inne';
}

// ── Gemini draft generator ────────────────────────────────────

async function generateDraft(product: B2BProduct, category: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const prompt = `Jesteś ekspertem content marketingu dla branży fotograficznej.
Firma: Gedeon Polska — producent i dystrybutor albumów, ramek, mediów DryLab i papieru KODAK.
Odbiorcy: studia fotograficzne, sklepy foto, minilabu, fotografowie B2B.

ZADANIE: Napisz krótki artykuł blogowy o nowym produkcie:
- Nazwa: ${product.name}
- SKU: ${product.sku}
- Kategoria: ${category}
- Opis: ${product.description.slice(0, 400)}

Odpowiedz TYLKO czystym JSON (bez markdown, bez objaśnień):
{
  "title_pl": "Tytuł SEO po polsku (max 70 znaków)",
  "title_en": "English title",
  "excerpt_pl": "Meta opis 150-160 znaków zachęcający do kliknięcia",
  "excerpt_en": "Meta description in English",
  "slug": "url-slug-po-polsku-bez-polskich-znakow",
  "category": "${category}",
  "tags": ["tag1", "tag2", "tag3"],
  "read_time": 5,
  "content_pl": [
    {"type": "lead", "text": "Wciągający lead 2-3 zdania"},
    {"type": "heading", "text": "Nagłówek H2"},
    {"type": "paragraph", "text": "Treść akapitu"},
    {"type": "tip", "text": "Praktyczna wskazówka dla fotografa"},
    {"type": "heading", "text": "Drugi nagłówek"},
    {"type": "paragraph", "text": "Więcej treści"},
    {"type": "cta", "text": "Zamów w sklepie B2B Gedeon", "url": "https://b2b.gedeonpolska.com", "ctaEn": "Order in B2B"}
  ]
}`;

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini ${response.status}: ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '')
    .replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();

  return JSON.parse(text);
}

// ── Main handler ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!B2B_XML_URL) {
    return NextResponse.json(
      { error: 'Sync failed', message: 'B2B_XML_URL is not configured' },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const autoDraftParam = searchParams.get('autoDraft');
  const autoDraft = autoDraftParam !== 'false'; // default to true unless explicitly disabled

  const result: SyncResult = {
    fetched: 0,
    newProducts: 0,
    productsUpserted: 0,
    topicsCreated: 0,
    draftsCreated: 0,
    errors: [],
  };

  try {
    // 1. Fetch B2B XML feed (no cache — always fresh)
    const xmlResponse = await fetch(B2B_XML_URL, {
      headers: { Accept: 'application/xml, text/xml' },
      cache: 'no-store',
    });

    if (!xmlResponse.ok) {
      throw new Error(`B2B XML fetch failed: ${xmlResponse.status}`);
    }

    const xmlText = await xmlResponse.text();
    const products = parseXmlProducts(xmlText);
    result.fetched = products.length;

    if (products.length === 0) {
      return NextResponse.json({ ...result, message: 'No products in XML feed' });
    }

    // 2. Get known SKUs from log + products to keep sync idempotent even if one source drifts.
    const { data: existingLogRows, error: logError } = await supabaseAdmin
      .from('pim_sync_log')
      .select('product_sku')
      .limit(10000);

    if (logError) throw new Error(`pim_sync_log read: ${logError.message}`);

    const { data: existingProductRows, error: productsReadError } = await supabaseAdmin
      .from('products')
      .select('sku')
      .limit(10000);

    if (productsReadError) throw new Error(`products read: ${productsReadError.message}`);

    const knownSkus = new Set<string>(
      [
        ...(existingLogRows ?? []).map((r: { product_sku: string }) => normalizeSku(r.product_sku)),
        ...(existingProductRows ?? []).map((r: { sku: string }) => normalizeSku(r.sku)),
      ]
    );

    // 3. Filter to only new products
    const newProducts = products.filter(p => !knownSkus.has(p.sku));
    result.newProducts = newProducts.length;

    // 4. Batch build rows for bulk insert
    const BATCH_SIZE = 500;

    const logRows: object[] = [];
    let topicRows: TopicInsertRow[] = [];
    const productRows: ProductUpsertRow[] = [];
    // Candidates for Gemini drafts (first MAX_DRAFTS_PER_RUN new products)
    const draftCandidates: Array<{ product: B2BProduct; category: string }> = [];

    for (const product of products) {
      const category = mapCategory(product.categories);
      const primaryImage = choosePrimaryB2BImage(product.images);
      productRows.push({
        sku: normalizeSku(product.sku),
        name: product.name,
        description: product.description.slice(0, 1000),
        category,
        b2b_url: product.url || `https://b2b.gedeonpolska.com/pl/p/${product.sku}`,
        image_url: primaryImage,
        is_active: product.inStock,
      });
    }

    for (const product of newProducts) {
      const category = mapCategory(product.categories);

      logRows.push({
        product_sku: normalizeSku(product.sku),
        event_type: 'new_product',
        payload: {
          id: product.id,
          name: product.name,
          description: product.description.slice(0, 500),
          category,
          priceNet: product.priceNet,
          inStock: product.inStock,
          imageUrl: choosePrimaryB2BImage(product.images),
          b2bUrl: product.url || `https://b2b.gedeonpolska.com/pl/p/${product.sku}`,
        },
        processed: false,
      });

      topicRows.push({
        title_pl: `Nowość: ${product.name}`,
        title_en: `New product: ${product.name}`,
        category,
        keywords: [product.sku, ...product.name.split(' ').slice(0, 3), category.toLowerCase()],
        source: 'pim_trigger',
        status: 'pending',
      });

      if (autoDraft && draftCandidates.length < MAX_DRAFTS_PER_RUN) {
        draftCandidates.push({ product, category });
      }
    }

    topicRows = await dedupeTopicRows(topicRows);

    // 5. Bulk upsert pim_sync_log in chunks (ignoreDuplicates = safe re-runs)
    for (let i = 0; i < logRows.length; i += BATCH_SIZE) {
      const chunk = logRows.slice(i, i + BATCH_SIZE);
      const { error } = await supabaseAdmin
        .from('pim_sync_log')
        .upsert(chunk, { onConflict: 'product_sku', ignoreDuplicates: true });
      if (error) result.errors.push(`pim_sync_log batch[${i}]: ${error.message}`);
    }

    // 6. Bulk upsert products in chunks (refreshes image_url/b2b_url for known SKUs)
    for (let i = 0; i < productRows.length; i += BATCH_SIZE) {
      const chunk = productRows.slice(i, i + BATCH_SIZE);
      const { error } = await supabaseAdmin
        .from('products')
        .upsert(chunk, { onConflict: 'sku' });
      if (error) {
        result.errors.push(`products upsert batch[${i}]: ${error.message}`);
      } else {
        result.productsUpserted += chunk.length;
      }
    }

    // 7. Bulk upsert topic_suggestions in chunks (idempotent by source + title_pl)
    for (let i = 0; i < topicRows.length; i += BATCH_SIZE) {
      const chunk = topicRows.slice(i, i + BATCH_SIZE);
      const { error } = await supabaseAdmin
        .from('topic_suggestions')
        .upsert(chunk, { onConflict: 'source,title_pl', ignoreDuplicates: true });
      if (error) {
        result.errors.push(`topic_suggestions batch[${i}]: ${error.message}`);
      } else {
        result.topicsCreated += chunk.length;
      }
    }

    // 8. Optionally auto-generate Gemini drafts (parallel, capped at MAX_DRAFTS_PER_RUN)
    await Promise.all(
      draftCandidates.map(async ({ product, category }) => {
        try {
          const articleData = await generateDraft(product, category);
          const slug =
            articleData.slug ?? `pim-${product.sku.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
          const coverImage = choosePrimaryB2BImage(product.images);
          const galleryImages = chooseGalleryB2BImages(product.images, 6);

          const baseDraft = {
            slug,
            title_pl: articleData.title_pl,
            title_en: articleData.title_en,
            excerpt_pl: articleData.excerpt_pl,
            excerpt_en: articleData.excerpt_en,
            content_pl: articleData.content_pl,
            category: articleData.category ?? category,
            tags: articleData.tags ?? [],
            cover_image: coverImage,
            cover_url: coverImage,
            gallery_images: galleryImages,
            read_time: articleData.read_time ?? 5,
            status: 'draft',
            source: 'pim_trigger',
            author: 'Zespół Gedeon',
            author_role: 'AI Generator',
          };

          const payloadVariants = [
            baseDraft,
            { ...baseDraft, gallery_images: undefined },
            { ...baseDraft, cover_image: undefined },
            { ...baseDraft, gallery_images: undefined, cover_image: undefined },
          ];

          let savedArticle: { id: string } | null = null;
          let draftError: { message: string } | null = null;

          for (const payload of payloadVariants) {
            const insertResult = await supabaseAdmin
              .from('articles')
              .insert(payload)
              .select('id')
              .single();

            if (!insertResult.error) {
              savedArticle = insertResult.data;
              draftError = null;
              break;
            }

            draftError = insertResult.error;
            if (!/(gallery_images|cover_image)/i.test(insertResult.error.message)) {
              break;
            }
          }

          if (draftError || !savedArticle) {
            if (!draftError) {
              result.errors.push(`article draft[${product.sku}]: save failed without explicit error`);
              return;
            }
            result.errors.push(`article draft[${product.sku}]: ${draftError.message}`);
          } else {
            result.draftsCreated++;
            await supabaseAdmin
              .from('pim_sync_log')
              .update({ processed: true, article_id: savedArticle.id })
              .eq('product_sku', normalizeSku(product.sku))
              .eq('processed', false);
          }
        } catch (geminiError) {
          result.errors.push(`gemini[${product.sku}]: ${String(geminiError)}`);
        }
      })
    );

    console.log('[PIM Sync] Complete:', result);

    return NextResponse.json({
      ...result,
      message: result.newProducts === 0
        ? `Sync complete. No new products, ${result.productsUpserted} products updated.`
        : `Sync complete. ${result.newProducts} new, ${result.productsUpserted} products updated, ${result.topicsCreated} topics, ${result.draftsCreated} drafts.`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[PIM Sync] Fatal error:', error);
    return NextResponse.json(
      {
        ...result,
        error: 'Sync failed',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
