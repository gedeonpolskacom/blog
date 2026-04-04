/**
 * Gedeon B2B API Integration
 * Route: GET /api/b2b/products
 * 
 * Uses XML Feed for product sync (simpler, no auth needed)
 * AND REST API for real-time stock checks
 */

import { NextRequest, NextResponse } from 'next/server';

const B2B_XML_URL = process.env.B2B_XML_URL ?? '';
const B2B_API_BASE = process.env.B2B_API_BASE ?? 'https://www.b2b.gedeonpolska.com';
const B2B_API_KEY = process.env.B2B_API_KEY ?? '';
const B2B_CLIENT_ID = process.env.B2B_CLIENT_ID ?? '';

// ── Types ────────────────────────────────────────────────────

export interface B2BProduct {
  id: string;
  sku: string;
  ean: string;
  name: string;
  model: string;
  brand: string;
  description: string;
  metaDescription: string;
  url: string;
  categories: string[];
  priceNet: number;
  retailPriceGross: number;
  inStock: boolean;
  qty: number;
  images: string[];
  attributes: Record<string, string>;
}

function parseB2BProductId(id: string): number {
  const parsed = Number.parseInt(id, 10);
  return Number.isFinite(parsed) ? parsed : Number.MIN_SAFE_INTEGER;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function stripHtmlToText(input: string): string {
  return decodeHtmlEntities(input)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickMetaDescription(product: B2BProduct): string {
  const directMeta = stripHtmlToText(product.metaDescription);
  if (directMeta) return directMeta;

  const attrEntry = Object.entries(product.attributes).find(([key, value]) => {
    return /meta[\s_-]*description/i.test(key) && value.trim().length > 0;
  });

  return stripHtmlToText(attrEntry?.[1] ?? '');
}

// ── Token generation ─────────────────────────────────────────

async function generateAuthToken(): Promise<string | null> {
  if (!B2B_API_KEY || !B2B_CLIENT_ID) {
    console.error('[B2B Products API] Missing B2B_API_KEY or B2B_CLIENT_ID env.');
    return null;
  }

  try {
    // Format: yyyy-MM-dd HH:mm:ss UTC
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').slice(0, 19);

    // Hash = md5(ApiKey + Timestamp + ClientId)
    const crypto = await import('crypto');
    const hash = crypto
      .createHash('md5')
      .update(`${B2B_API_KEY}${timestamp}${B2B_CLIENT_ID}`)
      .digest('hex');

    const response = await fetch(`${B2B_API_BASE}/api3/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: B2B_CLIENT_ID,
        timestamp,
        hash,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.token ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

// ── XML Feed parser ──────────────────────────────────────────

function parseXmlProducts(xmlText: string): B2BProduct[] {
  const products: B2BProduct[] = [];

  // Simple regex-based XML parser (no external deps needed)
  const productMatches = xmlText.matchAll(/<product[^>]*>([\s\S]*?)<\/product>/g);

  for (const match of productMatches) {
    const block = match[1];

    const get = (tag: string) =>
      block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\/${tag}>`))?.[1]
      ?? block.match(new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`))?.[1]
      ?? '';

    const photosSet = new Set<string>();
    const photoMatches = block.matchAll(/<photo[^>]*url=["']([^"']+)["']/gi);
    for (const p of photoMatches) {
      photosSet.add(decodeHtmlEntities(p[1]).trim());
    }

    // Fallback: some feeds expose direct asset URLs in product body.
    const inlineImageMatches = block.matchAll(
      /https?:\/\/(?:www\.)?b2b\.gedeonpolska\.com\/zasoby\/import\/[^\s<>"']+\.(?:jpe?g|png|webp)/gi
    );
    for (const p of inlineImageMatches) {
      photosSet.add(decodeHtmlEntities(p[0]).trim());
    }
    const photos = Array.from(photosSet);

    // Parse attributes
    const attrs: Record<string, string> = {};
    const attrMatches = block.matchAll(
      /<attribute[^>]*name="([^"]+)"[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/attribute>/gi
    );
    for (const a of attrMatches) {
      const name = a[1]?.trim();
      const value = (a[2] ?? a[3] ?? '').trim();
      if (name) attrs[name] = value;
    }

    // Parse categories — each <category> has CDATA content
    const cats: string[] = [];
    for (const c of block.matchAll(/<category[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/category>/g)) {
      cats.push(c[1]);
    }

    const product: B2BProduct = {
      id: get('id'),
      sku: get('sku'),
      ean: get('ean'),
      name: get('name'),
      model: get('model'),
      brand: get('brand'),
      description: get('desc'),
      metaDescription:
        get('meta_description') || get('metaDescription') || get('metadescription'),
      url: get('url'),
      categories: cats,
      priceNet: parseFloat(get('priceAfterDiscountNet')) || 0,
      retailPriceGross: parseFloat(get('retailPriceGross')) || 0,
      inStock: get('inStock').toLowerCase() === 'true',
      qty: parseInt(get('qty')) || 0,
      images: photos,
      attributes: attrs,
    };

    if (product.id && product.name) {
      products.push(product);
    }
  }

  return products;
}

// ── Category mapping ──────────────────────────────────────────

function mapToLocalCategory(b2bCategories: string[]): string {
  const catStr = b2bCategories.join(' ').toLowerCase();
  if (catStr.includes('album')) return 'Albumy';
  if (catStr.includes('ramk') || catStr.includes('antyram')) return 'Ramki';
  if (catStr.includes('drylab') || catStr.includes('media')) return 'Media';
  if (catStr.includes('kodak') || catStr.includes('papier')) return 'KODAK';
  return 'Inne';
}

// ── Main route handler ────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!B2B_XML_URL) {
    return NextResponse.json(
      { products: [], total: 0, error: 'B2B_XML_URL is not configured' },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const inStock = searchParams.get('inStock') === 'true';
  const newOnly = searchParams.get('new') === 'true';

  try {
    // Fetch XML product feed 
    const response = await fetch(B2B_XML_URL, {
      headers: { 'Accept': 'application/xml, text/xml' },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      throw new Error(`B2B API error: ${response.status}`);
    }

    const xmlText = await response.text();
    let products = parseXmlProducts(xmlText);

    // Apply filters
    if (category && category !== 'all') {
      products = products.filter(p => mapToLocalCategory(p.categories) === category);
    }
    if (inStock) {
      products = products.filter(p => p.inStock);
    }

    // Newest products first: higher B2B product ID = newer item.
    products = products.sort((a, b) => parseB2BProductId(b.id) - parseB2BProductId(a.id));

    // Apply limit 
    const paginated = products.slice(0, limit);

    // Map to blog-friendly format
    const mapped = paginated.map(p => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      description: (pickMetaDescription(p) || stripHtmlToText(p.description)).slice(0, 200),
      category: mapToLocalCategory(p.categories),
      b2bUrl: p.url || `https://b2b.gedeonpolska.com/pl/p/${p.sku}`,
      imageUrl: p.images[0] ?? null,
      inStock: p.inStock,
      isNew: newOnly, // Will be based on addedDate in production
      priceNet: p.priceNet,
      retailPriceGross: p.retailPriceGross,
    }));

    return NextResponse.json({
      products: mapped,
      total: products.length,
      fetched: mapped.length,
      source: 'b2b-xml-feed',
      cachedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[B2B Products API] Error:', error);

    // Fallback: return empty with error
    return NextResponse.json(
      {
        products: [],
        total: 0,
        error: 'Failed to fetch from B2B platform',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}

// ── Stock check endpoint helper ───────────────────────────────

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { skus } = body as { skus: string[] };

  if (!skus?.length) {
    return NextResponse.json({ error: 'skus required' }, { status: 400 });
  }

  const token = await generateAuthToken();
  if (!token) {
    return NextResponse.json({ error: 'Auth failed' }, { status: 401 });
  }

  try {
    const response = await fetch(`${B2B_API_BASE}/api3/product/stock`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({ stock: data });
    }
    throw new Error(`Stock API error: ${response.status}`);
  } catch (error) {
    return NextResponse.json(
      { error: 'Stock check failed', message: String(error) },
      { status: 503 }
    );
  }
}
