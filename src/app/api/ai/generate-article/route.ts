/**
 * Gemini AI Article Generator
 * Route: POST /api/ai/generate-article
 * 
 * Takes a topic/product data and generates a full article using Gemini Flash
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { findB2BCoverImage, findB2BGalleryImages } from '@/lib/b2b-images';
import { findPexelsCoverImage, findPexelsGalleryImages } from '@/lib/pexels';

export const dynamic = 'force-dynamic';

// Flash: szybki i tani — dla pojedynczych tematów
const GEMINI_FLASH_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
// Pro: mocniejszy — dla multi-topic i product (więcej kontekstu, lepszy JSON)
const GEMINI_PRO_URL   = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent';
const GEMINI_TIMEOUT_MS = 90000;
const GEMINI_USE_PRO_FOR_COMPLEX = /^(1|true|yes)$/i.test(process.env.GEMINI_USE_PRO_FOR_COMPLEX ?? '');
const SERPAPI_TIMEOUT_MS = 8000;
const SUGGESTIONS_CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6h

interface TopicItem {
  title_pl?: string;
  title_en?: string;
  category?: string;
  keywords?: string[];
}

interface GenerateRequest {
  mode: 'topic' | 'product' | 'news' | 'multi';
  // For topic mode
  titlePl?: string;
  titleEn?: string;
  category?: string;
  keywords?: string[];
  // For multi mode — array of topics
  topics?: TopicItem[];
  // For product mode
  productSku?: string;
  productName?: string;
  productDescription?: string;
  productCategory?: string;
  // Options
  lang?: 'pl' | 'en' | 'both';
  saveAsDraft?: boolean;
  articleKind?: 'auto' | 'product' | 'guide';
}

interface TopicSuggestion {
  title_pl: string;
  category: string;
  keywords: string[];
}

interface TrendSeed {
  query: string;
  category: string;
  keywords: string[];
}

interface SerpRelatedQuery {
  query?: string;
}

interface SerpTrendsResponse {
  error?: string;
  related_queries?: {
    top?: SerpRelatedQuery[];
    rising?: SerpRelatedQuery[];
  };
}

interface SuggestionsCacheEntry {
  expiresAt: number;
  source: 'serpapi' | 'static';
  suggestions: TopicSuggestion[];
}

const SERPAPI_SEEDS: TrendSeed[] = [
  {
    query: 'album fotograficzny',
    category: 'Albumy',
    keywords: ['album', 'zdjęcia', 'fotografia'],
  },
  {
    query: 'ramki na zdjęcia',
    category: 'Ramki',
    keywords: ['ramki', 'dekoracja', 'zdjęcia'],
  },
  {
    query: 'papier fotograficzny kodak',
    category: 'KODAK',
    keywords: ['papier fotograficzny', 'kodak', 'druk'],
  },
];

declare global {
  var __gedeonSuggestionsCache: SuggestionsCacheEntry | undefined;
}

function extractSkuHints(values: Array<string | undefined>): string[] {
  const hints = new Set<string>();
  const skuPattern = /\b[A-Z]{1,6}\d{2,}[A-Z0-9-]*\b/g;

  for (const value of values) {
    if (!value) continue;
    const upper = value.toUpperCase();
    const matches = upper.match(skuPattern) ?? [];
    for (const match of matches) {
      const cleaned = match.replace(/[^A-Z0-9-]/g, '');
      const hasStrongPrefix = /^[A-Z]{2,}/.test(cleaned);
      const startsNumeric = /^[0-9]/.test(cleaned);
      const longEnough = cleaned.length >= 6;

      // Avoid weak hints like "P3536" that produce false image paths.
      if (longEnough && (hasStrongPrefix || startsNumeric)) {
        hints.add(cleaned);
      }
    }
  }

  return Array.from(hints);
}

function extractPrimarySku(values: Array<string | undefined>): string | null {
  const all = extractSkuHints(values);
  return all[0] ?? null;
}

function normalizeCategory(value?: string) {
  return (value ?? '').trim().toLowerCase();
}

function isKnowledgeCategory(value?: string) {
  const category = normalizeCategory(value);
  if (!category) return false;
  return ['porad', 'trend', 'wiedz', 'blog', 'inspirac', 'news']
    .some((token) => category.includes(token));
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function mergeImages(primary: string | null, images: string[], max = 8) {
  const deduped = Array.from(new Set([primary, ...images].filter(Boolean) as string[]));
  return deduped.slice(0, max);
}

type AIContentBlock = {
  type?: string;
  text?: string;
  url?: string;
  ctaEn?: string;
  [key: string]: unknown;
};

function ensureAudienceSplit(content: unknown): AIContentBlock[] {
  const blocks = Array.isArray(content)
    ? content.filter((item): item is AIContentBlock => Boolean(item && typeof item === 'object'))
    : [];

  if (!blocks.length) return [];

  const headingText = (block: AIContentBlock) =>
    block.type === 'heading' ? String(block.text ?? '').toLowerCase() : '';

  const hasB2BSection = blocks.some((block) =>
    /(partner|hurtown|b2b|dla studia|dla sklepu)/i.test(headingText(block))
  );
  const hasEndCustomerSection = blocks.some((block) =>
    /(klient|konsument|użytkownik końcowy|detal)/i.test(headingText(block))
  );
  const hasB2BCta = blocks.some((block) =>
    block.type === 'cta'
    && typeof block.url === 'string'
    && /b2b\.gedeonpolska\.com/i.test(block.url)
  );

  const normalized = [...blocks];

  if (!hasB2BSection) {
    normalized.push(
      { type: 'heading', text: 'Dla partnerów B2B' },
      {
        type: 'paragraph',
        text: 'Ta część opisuje, jak produkt wspiera sprzedaż hurtową, ekspozycję i ofertę dla studiów fotograficznych oraz sklepów foto.',
      },
    );
  }

  if (!hasEndCustomerSection) {
    normalized.push(
      { type: 'heading', text: 'Jak komunikować to klientowi końcowemu' },
      {
        type: 'paragraph',
        text: 'Sekcja dla partnera: podpowiedz, jak tłumaczyć klientowi końcowemu korzyści produktu prostym językiem, bez obniżania marży i bez wojny cenowej.',
      },
    );
  }

  if (!hasB2BCta) {
    normalized.push({
      type: 'cta',
      text: 'Sprawdź warunki handlowe B2B',
      url: 'https://b2b.gedeonpolska.com',
      ctaEn: 'Check B2B terms',
    });
  }

  return normalized;
}

// ── Prompt builder ────────────────────────────────────────────

function getCachedSuggestions(): SuggestionsCacheEntry | null {
  const cache = globalThis.__gedeonSuggestionsCache;
  if (!cache) return null;
  if (cache.expiresAt <= Date.now()) return null;
  return cache;
}

function setCachedSuggestions(source: SuggestionsCacheEntry['source'], suggestions: TopicSuggestion[]) {
  globalThis.__gedeonSuggestionsCache = {
    source,
    suggestions,
    expiresAt: Date.now() + SUGGESTIONS_CACHE_TTL_MS,
  };
}

function formatTopicTitle(rawQuery: string, category: string): string {
  const normalized = rawQuery
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return `Trend 2026 - ${category}`;
  }

  const title = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  if (/\b(jak|co|dlaczego|kiedy|poradnik|trend)\b/i.test(title)) {
    return title;
  }

  if (category === 'KODAK' || category === 'Media') {
    return `${title} - praktyczny przewodnik dla fotografow`;
  }

  return `${title} - inspiracje i porady`;
}

function buildKeywords(rawQuery: string, seedKeywords: string[]): string[] {
  const tokens = rawQuery
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);

  return Array.from(new Set([...seedKeywords, ...tokens])).slice(0, 6);
}

async function fetchTrendSeedSuggestions(seed: TrendSeed, apiKey: string): Promise<TopicSuggestion[]> {
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google_trends');
  url.searchParams.set('data_type', 'RELATED_QUERIES');
  url.searchParams.set('q', seed.query);
  url.searchParams.set('geo', 'PL');
  url.searchParams.set('hl', 'pl');
  url.searchParams.set('date', 'today 12-m');
  url.searchParams.set('api_key', apiKey);

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), SERPAPI_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = (await response.json()) as SerpTrendsResponse;
    if (data.error) {
      throw new Error(data.error);
    }

    const candidates = [
      ...(data.related_queries?.rising ?? []),
      ...(data.related_queries?.top ?? []),
    ]
      .map((item) => item.query?.trim() ?? '')
      .filter((query, index, arr) => query.length >= 4 && arr.indexOf(query) === index)
      .slice(0, 3);

    return candidates.map((query) => ({
      title_pl: formatTopicTitle(query, seed.category),
      category: seed.category,
      keywords: buildKeywords(query, seed.keywords),
    }));
  } catch (error) {
    console.warn(`[AI Generator] SerpAPI seed fetch failed for "${seed.query}":`, error);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getSerpApiSuggestions(apiKey: string, limit = 6): Promise<TopicSuggestion[]> {
  const grouped = await Promise.all(
    SERPAPI_SEEDS.map((seed) => fetchTrendSeedSuggestions(seed, apiKey))
  );

  const flattened = grouped.flat();
  const deduped = new Map<string, TopicSuggestion>();
  for (const suggestion of flattened) {
    const key = suggestion.title_pl.toLowerCase();
    if (!deduped.has(key)) {
      deduped.set(key, suggestion);
    }
  }

  return Array.from(deduped.values()).slice(0, limit);
}

function buildPrompt(req: GenerateRequest): string {
  const baseContext = `
Jesteś ekspertem content marketingu dla branży fotograficznej. 
Piszesz dla firmy Gedeon Polska — producenta i dystrybutora albumów fotograficznych, ramek, antyram, papieru do drukarek atramentowych KODAK i mediów DryLab.
Główny odbiorca to partner B2B: studia fotograficzne, sklepy foto, minilaby i hurtownicy.
Jeśli opisujesz klienta końcowego, rób to wyłącznie jako wskazówki komunikacyjne dla partnera, a nie jako bezpośredni tekst sprzedażowy do konsumenta.

ZASADY:
- Używaj polskiego, profesjonalnego języka
- Pisz konkretnie i praktycznie — daj czytelnikowi realną wiedzę
- Linkuj naturalnie do platform: b2b.gedeonpolska.com i gedeonpolska.myshopify.com
- Unikaj korporacyjnego żargonu
- Dodaj praktyczne wskazówki dla fotografów 
- Artykuł ma być SEO-friendly dla polskiej branży foto
- Każdy artykuł musi zawierać osobne sekcje: "Dla partnerów B2B" oraz "Jak komunikować to klientowi końcowemu"
- W sekcji B2B podawaj argumenty handlowe: marża, rotacja, ekspozycja, cross-sell i sezonowość
- Nie zwracaj się bezpośrednio do konsumenta (unikaj form typu "kup teraz", "idealne do Twojego domu")
`;

  if (req.mode === 'product') {
    return `${baseContext}

ZADANIE: Napisz profesjonalny artykuł blogowy o produkcie:
- Nazwa: ${req.productName}
- SKU: ${req.productSku}
- Kategoria: ${req.productCategory}
- Opis: ${req.productDescription}

Struktura artykułu (JSON):
{
  "title_pl": "Tytuł artykułu po polsku (SEO, max 70 znaków)",
  "title_en": "Article title in English",
  "excerpt_pl": "Meta opis po polsku (150-160 znaków, zachęcający)",
  "excerpt_en": "Meta description in English",
  "slug": "url-slug-po-polsku",
  "category": "${req.productCategory ?? 'Produkty'}",
  "tags": ["tag1", "tag2", "tag3"],
  "read_time": 7,
  "content_pl": [
    {"type": "lead", "text": "Wciągający lead artykułu (2-3 zdania)"},
    {"type": "heading", "text": "Dla partnerów B2B"},
    {"type": "paragraph", "text": "Treść akapitu..."},
    {"type": "tip", "text": "Praktyczna wskazówka dla fotografa/sklepu"},
    {"type": "heading", "text": "Jak komunikować to klientowi końcowemu"},
    {"type": "paragraph", "text": "Wskazówki, jak partner może przedstawić wartość produktu klientowi detalicznemu."},
    {"type": "cta", "text": "Zamów produkt w B2B", "url": "https://b2b.gedeonpolska.com", "ctaEn": "Order in B2B"}
  ]
}

Odpowiedz TYLKO czystym JSON, bez markdown, bez objaśnień.`;
  }

  if (req.mode === 'topic') {
    return `${baseContext}

ZADANIE: Napisz profesjonalny artykuł blogowy na temat:
- Temat PL: ${req.titlePl}
- Temat EN: ${req.titleEn ?? ''}
- Kategoria: ${req.category ?? 'Blog'}
- Słowa kluczowe: ${req.keywords?.join(', ') ?? ''}

Struktura artykułu (JSON):
{
  "title_pl": "Tytuł po polsku (SEO-friendly, max 70 znaków)",
  "title_en": "English title",
  "excerpt_pl": "Meta opis (150-160 znaków)",
  "excerpt_en": "Meta description",
  "slug": "url-slug",
  "category": "${req.category ?? 'Blog'}",
  "tags": ["tag1", "tag2", "tag3"],
  "read_time": 8,
  "content_pl": [
    {"type": "lead", "text": "..."},
    {"type": "heading", "text": "Dla partnerów B2B"},
    {"type": "paragraph", "text": "..."},
    {"type": "tip", "text": "..."},
    {"type": "heading", "text": "Jak komunikować to klientowi końcowemu"},
    {"type": "paragraph", "text": "..."},
    {"type": "heading", "text": "Rekomendacja handlowa dla partnera"},
    {"type": "paragraph", "text": "..."},
    {"type": "cta", "text": "Sprawdź produkty Gedeon", "url": "https://b2b.gedeonpolska.com", "ctaEn": "Check Gedeon products"}
  ]
}

Odpowiedz TYLKO czystym JSON.`;
  }

  if (req.mode === 'multi' && req.topics && req.topics.length > 0) {
    const list = req.topics.map((t, i) =>
      `${i + 1}. ${t.title_pl}${t.category ? ` (${t.category})` : ''}${t.keywords?.length ? ` [${t.keywords.slice(0, 3).join(', ')}]` : ''}`
    ).join('\n');
    const mainCategory = req.topics[0].category ?? 'Produkty';
    return `${baseContext}

ZADANIE: Napisz profesjonalny artykuł blogowy łączący kilka powiązanych produktów Gedeon:

${list}

Napisz JEDEN spójny artykuł który:
- Przedstawia wszystkie powyższe produkty jako komplementarną ofertę
- Pokazuje jak pasują do siebie i do potrzeb fotografów/studiów
- Daje czytelnikowi kompletny przegląd tego segmentu

Struktura (JSON):
{
  "title_pl": "Tytuł łączący wszystkie produkty (SEO, max 70 znaków)",
  "title_en": "English title",
  "excerpt_pl": "Meta opis (150-160 znaków)",
  "excerpt_en": "Meta description",
  "slug": "url-slug",
  "category": "${mainCategory}",
  "tags": ["tag1", "tag2", "tag3", "tag4"],
  "read_time": 9,
  "content_pl": [
    {"type": "lead", "text": "..."},
    {"type": "heading", "text": "Dla partnerów B2B"},
    {"type": "paragraph", "text": "..."},
    {"type": "tip", "text": "..."},
    {"type": "heading", "text": "Jak komunikować to klientowi końcowemu"},
    {"type": "paragraph", "text": "..."},
    {"type": "cta", "text": "Zobacz pełną ofertę Gedeon", "url": "https://b2b.gedeonpolska.com", "ctaEn": "View Gedeon catalog"}
  ]
}

Odpowiedz TYLKO czystym JSON.`;
  }

  // news mode — PIM product news
  return `${baseContext}

ZADANIE: Napisz krótki artykuł o nowości produktowej.
Produkt: ${req.productName}
Opis: ${req.productDescription}

Stwórz krótki artykuł (5-6 bloków treści) informujący o nowości.
Format JSON jak wyżej. Odpowiedz TYLKO czystym JSON.`;
}

// ── Gemini API call ───────────────────────────────────────────

async function callGemini(prompt: string, usePro = false): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const apiUrl = usePro ? GEMINI_PRO_URL : GEMINI_FLASH_URL;
  const response = await fetch(`${apiUrl}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
        // Disable thinking for speed — we need deterministic JSON, not chain-of-thought
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = await response.json();

  // gemini-2.5-flash may return multiple parts: thought parts (thought: true) + text part
  // Find the actual text part, not the thinking part
  const parts: Array<{ text?: string; thought?: boolean }> =
    data.candidates?.[0]?.content?.parts ?? [];
  const textPart = parts.find(p => p.text && !p.thought) ?? parts[0];
  const text = textPart?.text ?? '';

  if (!text) {
    console.error('[AI Generator] Empty Gemini response:', JSON.stringify(data).slice(0, 300));
    throw new Error('Gemini returned empty response');
  }

  // Clean the response — remove markdown fences if Gemini wraps it
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

// ── Main handler ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as GenerateRequest;

    if (!body.mode) {
      return NextResponse.json({ error: 'mode required: topic | product | news' }, { status: 400 });
    }

    // Build prompt and call Gemini
    const prompt = buildPrompt(body);
    // Pro model dla złożonych zadań: multi-topic i product details
    const isComplexMode = body.mode === 'multi' || body.mode === 'product';
    const usePro = GEMINI_USE_PRO_FOR_COMPLEX && isComplexMode;
    console.log(`[AI Generator] mode=${body.mode}, model=${usePro ? 'gemini-3.1-pro-preview' : 'gemini-2.5-flash'}`);

    const rawJson = await Promise.race<string>([
      callGemini(prompt, usePro),
      new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error(`Gemini timeout after ${Math.round(GEMINI_TIMEOUT_MS / 1000)}s`)), GEMINI_TIMEOUT_MS);
      }),
    ]);

    // Parse the JSON response
    let articleData;
    try {
      articleData = JSON.parse(rawJson);
    } catch {
      console.error('[AI Generator] Invalid JSON from Gemini:', rawJson.slice(0, 200));
      return NextResponse.json({ 
        error: 'Invalid JSON from Gemini', 
        raw: rawJson.slice(0, 500) 
      }, { status: 500 });
    }

    articleData.content_pl = ensureAudienceSplit(articleData.content_pl);

    // Optionally save as draft to Supabase
    if (body.saveAsDraft && supabaseAdmin) {
      const baseSlug = articleData.slug ?? 'draft';
      const uniqueSlug = `${baseSlug}-${Date.now()}`;
      const keywordHints = [
        ...(body.keywords ?? []),
        ...(body.topics?.flatMap((topic) => topic.keywords ?? []) ?? []),
      ];
      const skuHints = Array.from(
        new Set([
          ...extractSkuHints([
            body.productSku,
            body.titlePl,
            body.productName,
            uniqueSlug,
            articleData.title_pl,
            ...(articleData.tags ?? []),
            ...keywordHints,
          ]),
          ...(body.productSku ? [body.productSku.toUpperCase()] : []),
        ])
      );
      const strictSku = extractPrimarySku([
        body.productSku,
        body.titlePl,
        ...(body.keywords ?? []),
        ...(body.topics?.map((topic) => topic.title_pl) ?? []),
        ...(body.topics?.flatMap((topic) => topic.keywords ?? []) ?? []),
      ]);
      const articleCategory = articleData.category ?? body.category;
      const articleTags = toStringArray(articleData.tags);
      const imageTags = [...articleTags, ...keywordHints];
      const imageTitle = articleData.title_pl ?? body.titlePl;
      const hasStrongSku = Boolean(strictSku ?? skuHints[0]);
      const articleKind = body.articleKind ?? 'auto';
      const forcePexelsOnly = articleKind === 'guide' && body.mode !== 'product';
      const forceB2BFirst = articleKind === 'product' || body.mode === 'product';
      const preferStock = body.mode !== 'product' && (
        forcePexelsOnly
        || (!forceB2BFirst && isKnowledgeCategory(articleCategory) && !hasStrongSku)
      );
      const allowB2BLookup = !forcePexelsOnly;

      let coverImage: string | null = null;
      let galleryImages: string[] = [];
      let coverImageSource: 'pexels' | 'b2b' | 'none' = 'none';

      if (preferStock) {
        const pexelsGallery = await findPexelsGalleryImages(
          { category: articleCategory, tags: imageTags },
          6,
        );
        const pexelsCover = pexelsGallery[0] ?? await findPexelsCoverImage({
          category: articleCategory,
          tags: imageTags,
        });

        if (pexelsCover) {
          coverImage = pexelsCover;
          galleryImages = mergeImages(pexelsCover, pexelsGallery, 8);
          coverImageSource = 'pexels';
        }
      }

      if (!coverImage && allowB2BLookup) {
        const b2bImage = await findB2BCoverImage({
          category: articleCategory,
          tags: imageTags,
          title: imageTitle,
          skuHints,
          strictSku: strictSku ?? undefined,
        });
        const b2bGallery = await findB2BGalleryImages({
          category: articleCategory,
          tags: imageTags,
          title: imageTitle,
          skuHints,
          strictSku: strictSku ?? undefined,
        }, 6);

        if (b2bImage || b2bGallery.length > 0) {
          coverImage = b2bImage ?? b2bGallery[0] ?? null;
          galleryImages = mergeImages(coverImage, b2bGallery, 8);
          coverImageSource = 'b2b';
        }
      }

      if (!coverImage) {
        const fallbackPexelsGallery = await findPexelsGalleryImages(
          { category: articleCategory, tags: imageTags },
          6,
        );
        const fallbackPexelsCover = fallbackPexelsGallery[0] ?? await findPexelsCoverImage({
          category: articleCategory,
          tags: imageTags,
        });

        if (fallbackPexelsCover) {
          coverImage = fallbackPexelsCover;
          galleryImages = mergeImages(fallbackPexelsCover, fallbackPexelsGallery, 8);
          coverImageSource = 'pexels';
        }
      }

      const draft = {
        slug: uniqueSlug,
        title_pl: articleData.title_pl,
        title_en: articleData.title_en,
        excerpt_pl: articleData.excerpt_pl,
        excerpt_en: articleData.excerpt_en,
        content_pl: articleData.content_pl,
        category: articleCategory,
        tags: articleTags,
        cover_image: coverImage,
        cover_url: coverImage,
        gallery_images: galleryImages,
        read_time: articleData.read_time ?? 7,
        status: 'draft' as const,
        source: 'ai_generated' as const,
        author: 'Zespół Gedeon',
        author_role: 'AI Generator',
      };

      const tryInsert = async (payload: Record<string, unknown>) => {
        return await supabaseAdmin
          .from('articles')
          .insert(payload)
          .select()
          .single();
      };

      const payloadVariants: Record<string, unknown>[] = [
        draft,
        { ...draft, gallery_images: undefined },
        { ...draft, cover_image: undefined },
        { ...draft, gallery_images: undefined, cover_image: undefined },
      ];

      let saved: { id?: string } | null = null;
      let error: { message: string } | null = null;

      for (const payload of payloadVariants) {
        const result = await tryInsert(payload);
        saved = result.data;
        error = result.error;

        if (!error) {
          break;
        }

        if (!/(gallery_images|cover_image)/i.test(error.message)) {
          break;
        }
      }

      if (error) {
        console.error('[AI Generator] Supabase save error:', error);
      }

      return NextResponse.json({
        success: true,
        article: {
          ...articleData,
          slug: uniqueSlug,
          category: articleCategory,
          tags: articleTags,
          cover_image: coverImage,
          gallery_images: galleryImages,
        },
        coverImageSource,
        saved: !error,
        id: saved?.id,
      });
    }

    return NextResponse.json({
      success: true,
      article: articleData,
      saved: false,
    });

  } catch (error) {
    console.error('[AI Generator] Error:', error);
    return NextResponse.json(
      { 
        error: 'Generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ── GET — topic suggestions from trends ───────────────────────

export async function GET() {
  const cached = getCachedSuggestions();
  if (cached) {
    return NextResponse.json({
      suggestions: cached.suggestions,
      source: cached.source,
      cached: true,
    });
  }

  const apiKey = process.env.SERPAPI_API_KEY ?? process.env.SERPAPI_KEY;
  if (apiKey) {
    const dynamicSuggestions = await getSerpApiSuggestions(apiKey);
    if (dynamicSuggestions.length > 0) {
      setCachedSuggestions('serpapi', dynamicSuggestions);
      return NextResponse.json({
        suggestions: dynamicSuggestions,
        source: 'serpapi',
        cached: false,
      });
    }
  }

  // In Week 3 this will query Google Trends + SerpAPI
  // For now returns curated suggestions based on Gedeon catalog
  
  const suggestions = [
    { title_pl: 'Albumy komunijne 2026 — jak wybrać idealny album?', category: 'Albumy', keywords: ['album komunijny', 'fotografia komunijna', 'studio', '2026'] },
    { title_pl: 'DryLab vs drukowanie atramentowe — co wybrać do minilabu?', category: 'Media', keywords: ['drylab', 'minilab', 'drukowanie foto'] },
    { title_pl: 'Ramki na zdjęcia — trendy dekoracyjne na 2026', category: 'Ramki', keywords: ['ramki foto', 'dekoracja wnętrz', 'trendy'] },
    { title_pl: 'Papier KODAK — przewodnik po gramatyrach i powierzchniach', category: 'KODAK', keywords: ['papier kodak', 'drukarka atramentowa', 'gramatura'] },
    { title_pl: 'Antramy szklane — galeria i dekoracja biura', category: 'Ramki', keywords: ['antyrama', 'szklana', 'galeria', 'biuro'] },
    { title_pl: 'Pakiety dla studiów fotograficznych — jak tworzyć oferty', category: 'Poradniki', keywords: ['studio foto', 'biznes', 'oferta', 'cennik'] },
  ];

  setCachedSuggestions('static', suggestions);
  return NextResponse.json({ suggestions, source: 'static', cached: false });
}

