/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, Calendar, Tag, Share2, BookOpen, ArrowRight, ExternalLink } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ArticleCard from '@/components/ArticleCard';
import { getArticleBySlug, getPublishedArticles, incrementArticleViews, type Article, type ArticleWithProducts } from '@/lib/supabase';
import { resolveCoverImage } from '@/lib/article-cover';
import { HOME_FEATURED_TAG } from '@/lib/homepage-featured';

const CATEGORY_EN: Record<string, string> = {
  Albumy: 'Albums', Ramki: 'Frames', Media: 'Media',
  KODAK: 'KODAK', Trendy: 'Trends', Poradniki: 'Guides',
};

function uniqStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function hideBrokenImage(currentTarget: HTMLImageElement) {
  const parent = currentTarget.parentElement;
  if (parent) {
    parent.style.display = 'none';
    return;
  }
  currentTarget.style.display = 'none';
}

function parseImageList(value: string): string[] {
  if (!value.trim()) return [];
  return Array.from(
    new Set(
      value
        .split(/[\r\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function moveItem<T>(values: T[], from: number, to: number): T[] {
  if (from === to) return values;
  if (from < 0 || to < 0 || from >= values.length || to >= values.length) return values;
  const next = [...values];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function normalizeBlocksForSave(blocks: ContentBlock[]): ContentBlock[] {
  return blocks
    .map((block) => ({
      ...block,
      text: typeof block.text === 'string' ? block.text.trim() : block.text,
      url: typeof block.url === 'string' ? block.url.trim() : block.url,
      alt: typeof block.alt === 'string' ? block.alt.trim() : block.alt,
      src: typeof block.src === 'string' ? block.src.trim() : block.src,
    }))
    .filter((block) => {
      if (['lead', 'heading', 'paragraph', 'tip', 'cta'].includes(block.type)) {
        return Boolean(block.text);
      }
      if (block.type === 'image') {
        return Boolean(block.src || block.url);
      }
      return true;
    });
}

function createPreviewSignature(params: {
  title: string;
  coverImage: string;
  galleryItems: string[];
  blocks: ContentBlock[];
}) {
  const normalizedGallery = params.galleryItems.map((item) => item.trim()).filter(Boolean);
  const normalizedBlocks = normalizeBlocksForSave(params.blocks);
  return JSON.stringify({
    title: params.title.trim(),
    coverImage: params.coverImage.trim(),
    gallery: normalizedGallery,
    blocks: normalizedBlocks,
  });
}

function createSnapshotSignature(snapshot: PreviewEditorSnapshot) {
  return JSON.stringify({
    title: snapshot.title,
    coverImage: snapshot.coverImage,
    galleryItems: snapshot.galleryItems,
    galleryInput: snapshot.galleryInput,
    blocks: snapshot.blocks,
    bodyScale: snapshot.bodyScale,
    heroTitleScale: snapshot.heroTitleScale,
    heroImageHeight: snapshot.heroImageHeight,
    galleryAspectRatio: snapshot.galleryAspectRatio,
    galleryColumns: snapshot.galleryColumns,
    inlineEditMode: snapshot.inlineEditMode,
  });
}

function deriveGalleryFromCoverUrl(coverUrl?: string | null, max = 6): string[] {
  if (!coverUrl) return [];
  const match = coverUrl.match(/^(https?:\/\/.+\/)([^\/]+)\.(jpe?g|png|webp)$/i);
  if (!match) return [coverUrl];

  const dir = match[1];
  const file = match[2];
  const ext = match[3];
  const root = file.replace(/[-_]\d+$/i, '');

  const generated = [
    `${dir}${root}.${ext}`,
    ...Array.from({ length: max }, (_, index) => `${dir}${root}_${index + 1}.${ext}`),
    ...Array.from({ length: max }, (_, index) => `${dir}${root}-${index + 1}.${ext}`),
  ];

  return uniqStrings([coverUrl, ...generated]).slice(0, max * 2 + 1);
}

function mapDbToArticleData(a: ArticleWithProducts): ArticleData {
  const productLinks = (a.article_products ?? []).map((ap) => ({
    name: ap.products?.name ?? '',
    url: ap.products?.b2b_url ?? `https://b2b.gedeonpolska.com/pl/p/${ap.products?.sku ?? ''}`,
    description: ap.products?.description?.slice(0, 80) ?? '',
  })).filter((p) => p.name);

  const coverImage = resolveCoverImage(a);
  const galleryImages = uniqStrings([
    ...(a.gallery_images ?? []),
    ...deriveGalleryFromCoverUrl(coverImage, 6),
  ]);

  return {
    id: a.id,
    slug: a.slug,
    title: a.title_pl,
    titleEn: a.title_en ?? a.title_pl,
    category: a.category,
    categoryEn: CATEGORY_EN[a.category] ?? a.category,
    date: a.published_at
      ? new Date(a.published_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
      : '',
    dateEn: a.published_at
      ? new Date(a.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : '',
    readTime: String(a.read_time ?? 5),
    coverColor: a.cover_color ?? 'linear-gradient(135deg, #1a1206 0%, #2d1f0a 100%)',
    coverImage,
    galleryImages,
    author: a.author,
    authorRole: a.author_role ?? 'Dział Marketingu',
    tags: (a.tags ?? []).filter((tag) => tag !== HOME_FEATURED_TAG),
    tagsEn: (a.tags ?? []).filter((tag) => tag !== HOME_FEATURED_TAG),
    productLinks,
    content: (a.content_pl as ContentBlock[]) ?? [],
  };
}

interface ContentBlock {
  type: string;
  text?: string;
  url?: string;
  ctaEn?: string;
  productIndex?: number;
  src?: string;
  alt?: string;
}

interface PreviewEditorSnapshot {
  title: string;
  coverImage: string;
  galleryItems: string[];
  galleryInput: string;
  blocks: ContentBlock[];
  bodyScale: number;
  heroTitleScale: number;
  heroImageHeight: number;
  galleryAspectRatio: string;
  galleryColumns: number;
  inlineEditMode: boolean;
}

interface ArticleData {
  id: string;
  slug: string;
  title: string;
  titleEn: string;
  category: string;
  categoryEn: string;
  date: string;
  dateEn: string;
  readTime: string;
  coverColor: string;
  coverImage?: string | null;
  galleryImages: string[];
  author: string;
  authorRole: string;
  tags: string[];
  tagsEn: string[];
  productLinks: { name: string; url: string; description: string }[];
  content: ContentBlock[];
}

function toCardShape(a: Article) {
  return {
    id: a.id,
    slug: a.slug,
    title: a.title_pl,
    titleEn: a.title_en ?? a.title_pl,
    excerpt: a.excerpt_pl ?? '',
    excerptEn: a.excerpt_en ?? a.excerpt_pl ?? '',
    category: a.category,
    categoryEn: CATEGORY_EN[a.category] ?? a.category,
    date: a.published_at
      ? new Date(a.published_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
      : '',
    readTime: a.read_time ? `${a.read_time} min` : '5 min',
    coverColor: a.cover_color ?? 'linear-gradient(135deg, #1a1206 0%, #2d1f0a 100%)',
    coverImage: resolveCoverImage(a),
  };
}

// Content Renderer

function ContentRenderer({ blocks, lang, productLinks, textScale = 1, inlineEditMode = false, onBlockChange }: {
  blocks: ContentBlock[];
  lang: 'pl' | 'en';
  productLinks: { name: string; url: string; description: string }[];
  textScale?: number;
  inlineEditMode?: boolean;
  onBlockChange?: (index: number, patch: Partial<ContentBlock>) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'lead':
            if (inlineEditMode && onBlockChange) {
              return (
                <textarea
                  key={i}
                  value={block.text ?? ''}
                  onChange={(event) => onBlockChange(i, { text: event.target.value })}
                  rows={4}
                  style={{
                    width: '100%',
                    fontSize: `${(1.15 * textScale).toFixed(3)}rem`,
                    color: 'var(--color-cream)',
                    lineHeight: 1.85,
                    borderLeft: '3px solid var(--color-gold)',
                    padding: '0.6rem 0.75rem 0.6rem 1.2rem',
                    fontStyle: 'italic',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.04)',
                    borderTop: '1px solid var(--glass-border)',
                    borderRight: '1px solid var(--glass-border)',
                    borderBottom: '1px solid var(--glass-border)',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'var(--font-body)',
                  }}
                />
              );
            }
            return (
              <p key={i} style={{
                fontSize: `${(1.15 * textScale).toFixed(3)}rem`,
                color: 'var(--color-cream)',
                lineHeight: 1.85,
                borderLeft: '3px solid var(--color-gold)',
                paddingLeft: '1.5rem',
                fontStyle: 'italic',
              }}>
                {block.text}
              </p>
            );
          case 'heading':
            if (inlineEditMode && onBlockChange) {
              return (
                <textarea
                  key={i}
                  value={block.text ?? ''}
                  onChange={(event) => onBlockChange(i, { text: event.target.value })}
                  rows={2}
                  style={{
                    width: '100%',
                    fontFamily: 'var(--font-display)',
                    fontSize: `clamp(${(1.4 * textScale).toFixed(3)}rem, ${(3 * textScale).toFixed(3)}vw, ${(1.9 * textScale).toFixed(3)}rem)`,
                    color: 'var(--color-cream)',
                    marginTop: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    borderBottom: '1px solid var(--glass-border)',
                    borderTop: '1px solid var(--glass-border)',
                    borderLeft: '1px solid var(--glass-border)',
                    borderRight: '1px solid var(--glass-border)',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.04)',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              );
            }
            return (
              <h2 key={i} style={{
                fontFamily: 'var(--font-display)',
                fontSize: `clamp(${(1.4 * textScale).toFixed(3)}rem, ${(3 * textScale).toFixed(3)}vw, ${(1.9 * textScale).toFixed(3)}rem)`,
                color: 'var(--color-cream)',
                marginTop: '0.5rem',
                paddingBottom: '0.75rem',
                borderBottom: '1px solid var(--glass-border)',
              }}>
                {block.text}
              </h2>
            );
          case 'paragraph':
            if (inlineEditMode && onBlockChange) {
              return (
                <textarea
                  key={i}
                  value={block.text ?? ''}
                  onChange={(event) => onBlockChange(i, { text: event.target.value })}
                  rows={5}
                  style={{
                    width: '100%',
                    fontSize: `${(1.05 * textScale).toFixed(3)}rem`,
                    lineHeight: 1.9,
                    color: 'var(--color-gray-muted)',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '10px',
                    padding: '0.6rem 0.75rem',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'var(--font-body)',
                  }}
                />
              );
            }
            return (
              <p key={i} style={{ fontSize: `${(1.05 * textScale).toFixed(3)}rem`, lineHeight: 1.9, color: 'var(--color-gray-muted)' }}>
                {block.text}
              </p>
            );
          case 'tip':
            if (inlineEditMode && onBlockChange) {
              return (
                <div key={i} style={{
                  background: 'var(--color-gold-dim)',
                  border: '1px solid rgba(212,168,83,0.3)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  position: 'relative',
                }}>
                  <div style={{
                    position: 'absolute', top: '-10px', left: '1.5rem',
                    background: 'var(--color-gold)',
                    color: 'var(--color-black)',
                    padding: '0.2rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}>
                    {lang === 'pl' ? '💡 Wskazówka' : '💡 Tip'}
                  </div>
                  <textarea
                    value={block.text ?? ''}
                    onChange={(event) => onBlockChange(i, { text: event.target.value })}
                    rows={4}
                    style={{
                      width: '100%',
                      fontSize: `${(0.95 * textScale).toFixed(3)}rem`,
                      color: 'var(--color-cream)',
                      lineHeight: 1.7,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(212,168,83,0.4)',
                      borderRadius: '10px',
                      padding: '0.55rem 0.7rem',
                      outline: 'none',
                      resize: 'vertical',
                      fontFamily: 'var(--font-body)',
                    }}
                  />
                </div>
              );
            }
            return (
              <div key={i} style={{
                background: 'var(--color-gold-dim)',
                border: '1px solid rgba(212,168,83,0.3)',
                borderRadius: '12px',
                padding: '1.5rem',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', top: '-10px', left: '1.5rem',
                  background: 'var(--color-gold)',
                  color: 'var(--color-black)',
                  padding: '0.2rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}>
                  {lang === 'pl' ? '💡 Wskazówka' : '💡 Tip'}
                </div>
                <p style={{ fontSize: `${(0.95 * textScale).toFixed(3)}rem`, color: 'var(--color-cream)', lineHeight: 1.7 }}>
                  {block.text}
                </p>
              </div>
            );
          case 'product-highlight': {
            const product = productLinks[block.productIndex ?? 0];
            if (!product) return null;
            return (
              <a
                key={i}
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}
              >
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '1.25rem',
                  background: 'var(--color-black-card)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '12px',
                  padding: '1.25rem 1.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-gold)';
                    e.currentTarget.style.boxShadow = '0 8px 30px rgba(212,168,83,0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--glass-border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{
                    width: '48px', height: '48px', flexShrink: 0,
                    borderRadius: '10px',
                    background: 'var(--color-gold-dim)',
                    border: '1px solid rgba(212,168,83,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <BookOpen size={20} color="var(--color-gold)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-gold)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                      {lang === 'pl' ? 'Produkt Gedeon' : 'Gedeon Product'}
                    </div>
                    <div style={{ fontSize: `${(0.95 * textScale).toFixed(3)}rem`, color: 'var(--color-cream)', fontWeight: 600 }}>
                      {product.name}
                    </div>
                    <div style={{ fontSize: `${(0.82 * textScale).toFixed(3)}rem`, color: 'var(--color-gray-muted)' }}>
                      {product.description}
                    </div>
                  </div>
                  <ExternalLink size={16} color="var(--color-gold)" />
                </div>
              </a>
            );
          }
          case 'cta':
            if (inlineEditMode && onBlockChange) {
              return (
                <div key={i} style={{
                  textAlign: 'center', padding: '1.25rem',
                  background: 'linear-gradient(135deg, var(--color-black-card) 0%, rgba(212,168,83,0.08) 100%)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '16px',
                  display: 'grid',
                  gap: '0.55rem',
                }}>
                  <input
                    value={block.text ?? ''}
                    onChange={(event) => onBlockChange(i, { text: event.target.value })}
                    className="newsletter-input"
                    placeholder={lang === 'pl' ? 'Tekst CTA' : 'CTA text'}
                  />
                  <input
                    value={block.url ?? ''}
                    onChange={(event) => onBlockChange(i, { url: event.target.value })}
                    className="newsletter-input"
                    placeholder="https://..."
                  />
                </div>
              );
            }
            return (
              <div key={i} style={{
                textAlign: 'center', padding: '2.5rem',
                background: 'linear-gradient(135deg, var(--color-black-card) 0%, rgba(212,168,83,0.08) 100%)',
                border: '1px solid var(--glass-border)',
                borderRadius: '16px',
              }}>
                <a href={block.url} target="_blank" rel="noopener noreferrer" className="btn-primary">
                  {lang === 'pl' ? block.text : block.ctaEn}
                  <ArrowRight size={16} />
                </a>
              </div>
            );
          case 'image': {
            const imageUrl = block.src ?? block.url;
            if (!imageUrl) return null;
            return (
              <div key={i} style={{ display: 'grid', gap: '0.45rem' }}>
                <a
                  href={imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'block', textDecoration: 'none' }}
                >
                  <img
                    src={imageUrl}
                    alt={block.alt ?? `${lang === 'pl' ? 'Zdjęcie artykułu' : 'Article image'} ${i + 1}`}
                    onError={(event) => hideBrokenImage(event.currentTarget)}
                    style={{
                      width: '100%',
                      borderRadius: '12px',
                      border: '1px solid var(--glass-border)',
                      display: 'block',
                      aspectRatio: '16 / 9',
                      objectFit: 'cover',
                    }}
                    loading="lazy"
                  />
                </a>
                {inlineEditMode && onBlockChange && (
                  <div style={{ display: 'grid', gap: '0.35rem' }}>
                    <input
                      value={block.src ?? block.url ?? ''}
                      onChange={(event) => onBlockChange(i, { src: event.target.value, url: event.target.value })}
                      className="newsletter-input"
                      placeholder="URL obrazu"
                    />
                    <input
                      value={block.alt ?? ''}
                      onChange={(event) => onBlockChange(i, { alt: event.target.value })}
                      className="newsletter-input"
                      placeholder="ALT obrazu"
                    />
                  </div>
                )}
              </div>
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
}

// Main Client Component

export default function BlogPostClient({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const [lang, setLang] = useState<'pl' | 'en'>('pl');
  const [article, setArticle] = useState<ArticleData | null | undefined>(undefined);
  const [relatedArticles, setRelatedArticles] = useState<ReturnType<typeof toCardShape>[]>([]);
  const [isPreviewEditorOpen, setIsPreviewEditorOpen] = useState(true);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewCoverImage, setPreviewCoverImage] = useState('');
  const [previewGalleryItems, setPreviewGalleryItems] = useState<string[]>([]);
  const [previewGalleryInput, setPreviewGalleryInput] = useState('');
  const [dragGalleryIndex, setDragGalleryIndex] = useState<number | null>(null);
  const [previewBlocks, setPreviewBlocks] = useState<ContentBlock[]>([]);
  const [previewBodyScale, setPreviewBodyScale] = useState(1);
  const [previewHeroTitleScale, setPreviewHeroTitleScale] = useState(1);
  const [previewHeroImageHeight, setPreviewHeroImageHeight] = useState(460);
  const [previewGalleryAspectRatio, setPreviewGalleryAspectRatio] = useState('4 / 3');
  const [previewGalleryColumns, setPreviewGalleryColumns] = useState(3);
  const [previewInlineEditMode, setPreviewInlineEditMode] = useState(true);
  const [previewAutosave, setPreviewAutosave] = useState(true);
  const [previewDirty, setPreviewDirty] = useState(false);
  const [previewLastSavedAt, setPreviewLastSavedAt] = useState<string | null>(null);
  const [previewHistoryIndex, setPreviewHistoryIndex] = useState(0);
  const [previewHistorySize, setPreviewHistorySize] = useState(1);
  const [previewSaving, setPreviewSaving] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewNotice, setPreviewNotice] = useState('');
  const savedSignatureRef = useRef('');
  const previewHistoryRef = useRef<PreviewEditorSnapshot[]>([]);
  const previewHistoryCursorRef = useRef(0);
  const applyingHistoryRef = useRef(false);
  const hydratedPreviewArticleIdRef = useRef<string | null>(null);
  const [isPreview] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return new URLSearchParams(window.location.search).get('preview') === '1';
  });
  const readingProgress = 0;
  const activeTitle = isPreview
    ? (previewTitle.trim() || article?.title || '')
    : (lang === 'pl' ? article?.title ?? '' : article?.titleEn ?? '');
  const activeContent = isPreview ? previewBlocks : (article?.content ?? []);
  const activeCoverImage = isPreview
    ? (previewCoverImage.trim() || null)
    : (article?.coverImage ?? null);
  const previewGalleryNormalized = previewGalleryItems
    .map((item) => item.trim())
    .filter(Boolean);
  const galleryImages = isPreview
    ? previewGalleryNormalized
    : (article?.galleryImages ?? []);
  const heroImages = uniqStrings([activeCoverImage, ...galleryImages]).slice(0, 1);
  const heroMainImage = heroImages[0] ?? null;
  const sidebarImage = galleryImages.find((img) => img !== heroMainImage) ?? heroMainImage;
  const heroRatioParam = searchParams.get('hero');
  const heroRatioClass =
    heroRatioParam === '6040'
      ? 'hero-stage-6040'
      : heroRatioParam === '5050'
        ? 'hero-stage-5050'
        : 'hero-stage-5545';
  const articleLayoutColumns = 'minmax(0, 1fr) 320px';
  const articleLayoutGap = '3rem';
  const gallerySectionTitle = article?.productLinks?.length
    ? (lang === 'pl' ? 'Galeria produktu' : 'Product gallery')
    : (lang === 'pl' ? 'Galeria artykułu' : 'Article gallery');

  const heroTitleScale = isPreview ? previewHeroTitleScale : 1;
  const heroTitleSize = `clamp(${(2.4 * heroTitleScale).toFixed(3)}rem, ${(5.4 * heroTitleScale).toFixed(3)}vw, ${(5.2 * heroTitleScale).toFixed(3)}rem)`;
  const heroImageHeight = isPreview ? `${previewHeroImageHeight}px` : '460px';
  const galleryAspectRatio = isPreview ? previewGalleryAspectRatio : '4 / 3';
  const galleryColumns = isPreview ? previewGalleryColumns : 3;
  const canUndoPreview = previewHistoryIndex > 0;
  const canRedoPreview = previewHistoryIndex < previewHistorySize - 1;
  const previewLastSavedLabel = useMemo(() => {
    if (!previewLastSavedAt) return '';
    return new Date(previewLastSavedAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, [previewLastSavedAt]);

  const capturePreviewSnapshot = useCallback((): PreviewEditorSnapshot => ({
    title: previewTitle,
    coverImage: previewCoverImage,
    galleryItems: [...previewGalleryItems],
    galleryInput: previewGalleryInput,
    blocks: previewBlocks.map((block) => ({ ...block })),
    bodyScale: previewBodyScale,
    heroTitleScale: previewHeroTitleScale,
    heroImageHeight: previewHeroImageHeight,
    galleryAspectRatio: previewGalleryAspectRatio,
    galleryColumns: previewGalleryColumns,
    inlineEditMode: previewInlineEditMode,
  }), [
    previewTitle,
    previewCoverImage,
    previewGalleryItems,
    previewGalleryInput,
    previewBlocks,
    previewBodyScale,
    previewHeroTitleScale,
    previewHeroImageHeight,
    previewGalleryAspectRatio,
    previewGalleryColumns,
    previewInlineEditMode,
  ]);

  const applyPreviewSnapshot = useCallback((snapshot: PreviewEditorSnapshot) => {
    applyingHistoryRef.current = true;
    setPreviewTitle(snapshot.title);
    setPreviewCoverImage(snapshot.coverImage);
    setPreviewGalleryItems(snapshot.galleryItems);
    setPreviewGalleryInput(snapshot.galleryInput);
    setPreviewBlocks(snapshot.blocks.map((block) => ({ ...block })));
    setPreviewBodyScale(snapshot.bodyScale);
    setPreviewHeroTitleScale(snapshot.heroTitleScale);
    setPreviewHeroImageHeight(snapshot.heroImageHeight);
    setPreviewGalleryAspectRatio(snapshot.galleryAspectRatio);
    setPreviewGalleryColumns(snapshot.galleryColumns);
    setPreviewInlineEditMode(snapshot.inlineEditMode);
    setTimeout(() => {
      applyingHistoryRef.current = false;
    }, 0);
  }, []);

  const resetPreviewHistory = useCallback((snapshot: PreviewEditorSnapshot) => {
    previewHistoryRef.current = [snapshot];
    previewHistoryCursorRef.current = 0;
    setPreviewHistoryIndex(0);
    setPreviewHistorySize(1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fallbackTimer = setTimeout(() => {
      if (!cancelled) {
        setArticle((current) => (current === undefined ? null : current));
      }
    }, 8000);

    if (isPreview) {
      const controller = new AbortController();
      const previewTimeout = setTimeout(() => controller.abort(), 7000);

      fetch(`/api/admin/articles?slug=${encodeURIComponent(slug)}`, { signal: controller.signal })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!cancelled) {
            setArticle(data ? mapDbToArticleData(data as ArticleWithProducts) : null);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setArticle(null);
          }
        })
        .finally(() => clearTimeout(previewTimeout));
    } else {
      getArticleBySlug(slug)
        .then(data => {
          if (cancelled) return;

          if (data) {
            setArticle(mapDbToArticleData(data));
            return;
          }

          // Fallback: allow admin preview even without ?preview=1 when article is still draft.
          return fetch(`/api/admin/articles?slug=${encodeURIComponent(slug)}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((adminData) => {
              if (!cancelled) {
                setArticle(adminData ? mapDbToArticleData(adminData as ArticleWithProducts) : null);
              }
            })
            .catch(() => {
              if (!cancelled) {
                setArticle(null);
              }
            });
        })
        .catch(() => {
          if (!cancelled) {
            setArticle(null);
          }
        });
    }

    getPublishedArticles({ limit: 4 })
      .then(data => {
        if (!cancelled) {
          setRelatedArticles(
            data.filter(a => a.slug !== slug).slice(0, 3).map(toCardShape)
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRelatedArticles([]);
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
    };
  }, [isPreview, slug]);

  useEffect(() => {
    if (isPreview || !article) {
      return;
    }

    const viewedKey = `article-viewed:${article.slug}`;

    try {
      if (window.sessionStorage.getItem(viewedKey)) {
        return;
      }

      window.sessionStorage.setItem(viewedKey, '1');
    } catch {
      // Ignore storage failures and still attempt the RPC once.
    }

    incrementArticleViews(article.id)
      .catch((error) => {
        console.error('[Views] Failed to increment article views:', error);
      });
  }, [article, isPreview]);

  useEffect(() => {
    if (!article || isPreview) return;
    const currentCount = article.galleryImages?.length ?? 0;
    if (currentCount > 1) return;

    let cancelled = false;

    fetch(`/api/articles/gallery?slug=${encodeURIComponent(article.slug)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const fetched = Array.isArray(data.gallery_images) ? data.gallery_images as string[] : [];
        if (fetched.length <= currentCount) return;

        setArticle((current) => {
          if (!current || current.slug !== article.slug) return current;
          return {
            ...current,
            galleryImages: fetched,
          };
        });
      })
      .catch(() => {
        // Silent fallback: keep current single-image view.
      });

    return () => {
      cancelled = true;
    };
  }, [article, isPreview]);

  useEffect(() => {
    if (!isPreview || !article) return;
    if (hydratedPreviewArticleIdRef.current === article.id) return;
    const initialSnapshot: PreviewEditorSnapshot = {
      title: article.title,
      coverImage: article.coverImage ?? '',
      galleryItems: [...(article.galleryImages ?? [])],
      galleryInput: '',
      blocks: (article.content ?? []).map((block) => ({ ...block })),
      bodyScale: 1,
      heroTitleScale: 1,
      heroImageHeight: 460,
      galleryAspectRatio: '4 / 3',
      galleryColumns: 3,
      inlineEditMode: true,
    };

    applyPreviewSnapshot(initialSnapshot);
    setPreviewError('');
    setPreviewNotice('');
    setPreviewDirty(false);
    setPreviewLastSavedAt(null);
    savedSignatureRef.current = createPreviewSignature({
      title: article.title,
      coverImage: article.coverImage ?? '',
      galleryItems: article.galleryImages ?? [],
      blocks: (article.content ?? []).map((block) => ({ ...block })),
    });
    resetPreviewHistory(initialSnapshot);
    setDragGalleryIndex(null);
    hydratedPreviewArticleIdRef.current = article.id;
  }, [article?.id, isPreview, article, applyPreviewSnapshot, resetPreviewHistory]);

  useEffect(() => {
    if (isPreview) return;
    hydratedPreviewArticleIdRef.current = null;
  }, [isPreview]);

  const previewPersistSignature = useMemo(
    () => createPreviewSignature({
      title: previewTitle,
      coverImage: previewCoverImage,
      galleryItems: previewGalleryItems,
      blocks: previewBlocks,
    }),
    [previewTitle, previewCoverImage, previewGalleryItems, previewBlocks]
  );

  useEffect(() => {
    if (!isPreview || !article) return;
    setPreviewDirty(previewPersistSignature !== savedSignatureRef.current);
  }, [isPreview, article?.id, previewPersistSignature, article]);

  useEffect(() => {
    if (!isPreview || !article) return;
    if (applyingHistoryRef.current) return;

    const snapshot = capturePreviewSnapshot();
    const history = previewHistoryRef.current;
    const cursor = previewHistoryCursorRef.current;
    const current = history[cursor];

    if (current && createSnapshotSignature(current) === createSnapshotSignature(snapshot)) {
      return;
    }

    let nextHistory = history.slice(0, cursor + 1);
    nextHistory.push(snapshot);

    const maxHistory = 80;
    if (nextHistory.length > maxHistory) {
      nextHistory = nextHistory.slice(nextHistory.length - maxHistory);
    }

    previewHistoryRef.current = nextHistory;
    previewHistoryCursorRef.current = nextHistory.length - 1;
    setPreviewHistoryIndex(previewHistoryCursorRef.current);
    setPreviewHistorySize(nextHistory.length);
  }, [isPreview, article?.id, capturePreviewSnapshot, previewPersistSignature, article]);

  const handleUndoPreview = useCallback(() => {
    const cursor = previewHistoryCursorRef.current;
    if (cursor <= 0) return;
    const nextCursor = cursor - 1;
    const snapshot = previewHistoryRef.current[nextCursor];
    if (!snapshot) return;
    applyPreviewSnapshot(snapshot);
    previewHistoryCursorRef.current = nextCursor;
    setPreviewHistoryIndex(nextCursor);
    setPreviewHistorySize(previewHistoryRef.current.length);
    setPreviewNotice('Cofnięto zmianę.');
    setPreviewError('');
  }, [applyPreviewSnapshot]);

  const handleRedoPreview = useCallback(() => {
    const cursor = previewHistoryCursorRef.current;
    const nextCursor = cursor + 1;
    const snapshot = previewHistoryRef.current[nextCursor];
    if (!snapshot) return;
    applyPreviewSnapshot(snapshot);
    previewHistoryCursorRef.current = nextCursor;
    setPreviewHistoryIndex(nextCursor);
    setPreviewHistorySize(previewHistoryRef.current.length);
    setPreviewNotice('Przywrócono zmianę.');
    setPreviewError('');
  }, [applyPreviewSnapshot]);

  const updatePreviewBlock = (index: number, patch: Partial<ContentBlock>) => {
    setPreviewBlocks((prev) => prev.map((block, i) => (i === index ? { ...block, ...patch } : block)));
  };

  const movePreviewBlock = (index: number, direction: -1 | 1) => {
    setPreviewBlocks((prev) => moveItem(prev, index, index + direction));
  };

  const duplicatePreviewBlock = (index: number) => {
    setPreviewBlocks((prev) => {
      if (!prev[index]) return prev;
      const copy = { ...prev[index] };
      return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
    });
  };

  const removePreviewBlock = (index: number) => {
    setPreviewBlocks((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const addPreviewBlock = (type: string) => {
    const template: ContentBlock =
      type === 'heading'
        ? { type: 'heading', text: '' }
        : type === 'paragraph'
          ? { type: 'paragraph', text: '' }
          : type === 'tip'
            ? { type: 'tip', text: '' }
            : type === 'cta'
              ? { type: 'cta', text: '', url: '' }
              : type === 'image'
                ? { type: 'image', src: '', url: '', alt: '' }
                : { type: 'paragraph', text: '' };
    setPreviewBlocks((prev) => [...prev, template]);
  };

  const autofillImageAlts = () => {
    const base = previewTitle.trim() || 'Zdjęcie artykułu';
    let imageCounter = 0;
    setPreviewBlocks((prev) => prev.map((block) => {
      if (block.type !== 'image') return block;
      imageCounter += 1;
      return {
        ...block,
        alt: block.alt?.trim() ? block.alt : `${base} ${imageCounter}`,
      };
    }));
    setPreviewNotice('Uzupełniono ALT-y w blokach image.');
  };

  const handleAddPreviewGalleryUrls = () => {
    const parsed = parseImageList(previewGalleryInput);
    if (!parsed.length) return;
    setPreviewGalleryItems((prev) => uniqStrings([...prev, ...parsed]));
    setPreviewGalleryInput('');
    setPreviewError('');
  };

  const updatePreviewGalleryItem = (index: number, value: string) => {
    setPreviewGalleryItems((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const removePreviewGalleryItem = (index: number) => {
    setPreviewGalleryItems((prev) => prev.filter((_, i) => i !== index));
    setPreviewError('');
  };

  const dedupePreviewGallery = () => {
    setPreviewGalleryItems((prev) => uniqStrings(prev.map((item) => item.trim()).filter(Boolean)));
    setPreviewNotice('Usunięto duplikaty w galerii.');
  };

  const appendImagesFromBlocks = () => {
    const imagesFromBlocks = previewBlocks
      .map((block) => block.src ?? (block.type === 'image' ? block.url : undefined))
      .filter(Boolean) as string[];
    if (!imagesFromBlocks.length) {
      setPreviewNotice('Brak bloków image z URL do dodania.');
      return;
    }
    setPreviewGalleryItems((prev) => uniqStrings([...prev, ...imagesFromBlocks]));
    setPreviewNotice('Dodano zdjęcia z bloków image do galerii.');
  };

  const pinCoverAsFirstGalleryImage = () => {
    const cover = previewCoverImage.trim();
    if (!cover) {
      setPreviewError('Ustaw najpierw URL zdjęcia hero/cover.');
      return;
    }
    setPreviewGalleryItems((prev) => [cover, ...prev.map((item) => item.trim()).filter((item) => item && item !== cover)]);
    setPreviewError('');
    setPreviewNotice('Ustawiono zdjęcie cover jako pierwsze w galerii.');
  };

  const copyPreviewAsJson = async () => {
    try {
      const payload = {
        title_pl: previewTitle.trim(),
        cover_image: previewCoverImage.trim() || null,
        gallery_images: previewGalleryItems.map((item) => item.trim()).filter(Boolean),
        content_pl: normalizeBlocksForSave(previewBlocks),
      };
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setPreviewNotice('Skopiowano JSON draftu do schowka.');
      setPreviewError('');
    } catch {
      setPreviewError('Nie udało się skopiować JSON do schowka.');
    }
  };

  const pastePreviewFromJson = async () => {
    try {
      const raw = await navigator.clipboard.readText();
      const parsed = JSON.parse(raw) as {
        title_pl?: string;
        cover_image?: string | null;
        gallery_images?: string[] | string;
        content_pl?: ContentBlock[];
      };
      if (typeof parsed.title_pl === 'string') setPreviewTitle(parsed.title_pl);
      if (typeof parsed.cover_image === 'string' || parsed.cover_image === null) setPreviewCoverImage(parsed.cover_image ?? '');
      if (parsed.gallery_images !== undefined) {
        const nextGallery = Array.isArray(parsed.gallery_images)
          ? parsed.gallery_images.map((item) => String(item))
          : parseImageList(String(parsed.gallery_images ?? ''));
        setPreviewGalleryItems(uniqStrings(nextGallery));
      }
      if (Array.isArray(parsed.content_pl)) {
        setPreviewBlocks(parsed.content_pl.map((block) => ({ ...block })));
      }
      setPreviewNotice('Wczytano dane draftu ze schowka.');
      setPreviewError('');
    } catch {
      setPreviewError('Schowek nie zawiera poprawnego JSON draftu.');
    }
  };

  const savePreviewEdits = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!article) return;
    if (previewSaving) return;
    const nextTitle = previewTitle.trim();
    if (!nextTitle) {
      if (!silent) setPreviewError('Tytuł nie może być pusty.');
      return;
    }

    const sanitizedBlocks = normalizeBlocksForSave(previewBlocks);

    if (!sanitizedBlocks.length) {
      if (!silent) setPreviewError('Dodaj przynajmniej jeden blok treści.');
      return;
    }

    setPreviewSaving(true);
    setPreviewError('');
    setPreviewNotice('');
    const galleryUrls = previewGalleryItems.map((item) => item.trim()).filter(Boolean);
    const coverImage = previewCoverImage.trim();

    try {
      const res = await fetch('/api/admin/articles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: article.id,
          title_pl: nextTitle,
          content_pl: sanitizedBlocks,
          cover_image: coverImage,
          gallery_images: galleryUrls,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error ?? 'Nie udało się zapisać zmian.');
      }

      const nextGallery = galleryUrls.length ? galleryUrls : (coverImage ? [coverImage] : []);
      setPreviewBlocks(sanitizedBlocks);
      setPreviewGalleryItems(nextGallery);
      setArticle((current) => {
        if (!current || current.id !== article.id) return current;
        return {
          ...current,
          title: nextTitle,
          titleEn: nextTitle,
          coverImage: coverImage || null,
          galleryImages: nextGallery,
          content: sanitizedBlocks,
        };
      });
      setPreviewLastSavedAt(new Date().toISOString());
      savedSignatureRef.current = createPreviewSignature({
        title: nextTitle,
        coverImage,
        galleryItems: nextGallery,
        blocks: sanitizedBlocks,
      });
      setPreviewDirty(false);
      setPreviewNotice(silent ? 'Autozapis zakończony.' : 'Zapisano zmiany draftu.');
    } catch (error) {
      if (!silent) setPreviewError(error instanceof Error ? error.message : 'Nie udało się zapisać zmian.');
    } finally {
      setPreviewSaving(false);
    }
  }, [article, previewBlocks, previewCoverImage, previewGalleryItems, previewSaving, previewTitle]);

  const handleSavePreviewEdits = () => {
    void savePreviewEdits({ silent: false });
  };

  useEffect(() => {
    if (!isPreview || !article || !previewAutosave || !previewDirty || previewSaving) return;
    const timeout = setTimeout(() => {
      void savePreviewEdits({ silent: true });
    }, 1400);
    return () => clearTimeout(timeout);
  }, [isPreview, article?.id, previewAutosave, previewDirty, previewPersistSignature, previewSaving, savePreviewEdits, article]);

  useEffect(() => {
    if (!isPreview) return;
    const handleShortcut = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === 's') {
        event.preventDefault();
        void savePreviewEdits({ silent: false });
        return;
      }
      if ((event.ctrlKey || event.metaKey) && key === 'z' && !event.shiftKey) {
        event.preventDefault();
        handleUndoPreview();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && (key === 'y' || (key === 'z' && event.shiftKey))) {
        event.preventDefault();
        handleRedoPreview();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [isPreview, savePreviewEdits, handleUndoPreview, handleRedoPreview]);

  if (article === undefined) {
    return (
      <>
        <Navbar lang={lang} onLangChange={setLang} />
        <main style={{ paddingTop: '80px', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'var(--color-gray-muted)' }}>{lang === 'pl' ? 'Ładowanie…' : 'Loading…'}</p>
        </main>
        <Footer lang={lang} />
      </>
    );
  }

  if (article === null) {
    return (
      <>
        <Navbar lang={lang} onLangChange={setLang} />
        <main style={{ paddingTop: '80px', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'var(--color-gray-muted)' }}>{lang === 'pl' ? 'Artykuł nie istnieje.' : 'Article not found.'}</p>
        </main>
        <Footer lang={lang} />
      </>
    );
  }

  return (
    <>
      <Navbar lang={lang} onLangChange={setLang} />

      {/* Reading progress bar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '3px',
        background: 'var(--color-black-card)', zIndex: 200,
      }}>
        <div style={{
          height: '100%',
          width: `${readingProgress}%`,
          background: 'var(--color-gold)',
          transition: 'width 0.1s ease',
        }} />
      </div>

      <main style={{ paddingTop: '80px' }}>
        {/* Preview banner */}
        {isPreview && (
          <div style={{
            background: 'rgba(212,168,83,0.15)', borderBottom: '1px solid rgba(212,168,83,0.4)',
            padding: '0.6rem 1.5rem', textAlign: 'center', fontSize: '0.82rem',
            color: 'var(--color-gold)', fontFamily: 'var(--font-body)', fontWeight: 600,
          }}>
            👁 Podgląd draftu — artykuł nie jest jeszcze opublikowany
          </div>
        )}

        {isPreview && (
          <div className="container-site" style={{ paddingTop: '1rem', paddingBottom: '0.5rem' }}>
            <div style={{
              border: '1px solid rgba(212,168,83,0.35)',
              borderRadius: '14px',
              background: 'var(--surface-overlay-soft)',
              padding: '0.9rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-cream)' }}>
                  Edytor podglądu draftu
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '0.72rem',
                    color: previewDirty ? '#f59e0b' : '#10b981',
                    border: `1px solid ${previewDirty ? 'rgba(245,158,11,0.4)' : 'rgba(16,185,129,0.35)'}`,
                    borderRadius: '999px',
                    padding: '0.2rem 0.55rem',
                  }}>
                    {previewDirty ? 'Niezapisane zmiany' : 'Wszystko zapisane'}
                  </span>
                  {previewLastSavedLabel && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-gray-muted)' }}>
                      Ostatni zapis: {previewLastSavedLabel}
                    </span>
                  )}
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.74rem', color: 'var(--color-gray-muted)' }}>
                    <input
                      type="checkbox"
                      checked={previewAutosave}
                      onChange={(e) => setPreviewAutosave(e.target.checked)}
                    />
                    Autosave
                  </label>
                  <button
                    type="button"
                    onClick={handleUndoPreview}
                    disabled={!canUndoPreview}
                    className="btn-ghost"
                    style={{ padding: '0.4rem 0.65rem', fontSize: '0.74rem', opacity: canUndoPreview ? 1 : 0.45 }}
                    title="Cofnij (Ctrl/Cmd+Z)"
                  >
                    Cofnij
                  </button>
                  <button
                    type="button"
                    onClick={handleRedoPreview}
                    disabled={!canRedoPreview}
                    className="btn-ghost"
                    style={{ padding: '0.4rem 0.65rem', fontSize: '0.74rem', opacity: canRedoPreview ? 1 : 0.45 }}
                    title="Ponów (Ctrl/Cmd+Shift+Z / Ctrl+Y)"
                  >
                    Ponów
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPreviewEditorOpen((v) => !v)}
                    className="btn-ghost"
                    style={{ padding: '0.45rem 0.75rem', fontSize: '0.78rem' }}
                  >
                    {isPreviewEditorOpen ? 'Zwiń panel' : 'Rozwiń panel'}
                  </button>
                </div>
              </div>

              {isPreviewEditorOpen && (
                <div style={{ marginTop: '0.85rem', display: 'grid', gap: '0.85rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
                    <label style={{ display: 'grid', gap: '0.3rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-gray-muted)' }}>Tytuł artykułu</span>
                      <input
                        value={previewTitle}
                        onChange={(e) => setPreviewTitle(e.target.value)}
                        className="newsletter-input"
                      />
                    </label>
                    <label style={{ display: 'grid', gap: '0.3rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-gray-muted)' }}>URL zdjęcia hero/cover</span>
                      <input
                        value={previewCoverImage}
                        onChange={(e) => setPreviewCoverImage(e.target.value)}
                        className="newsletter-input"
                        placeholder="https://..."
                      />
                    </label>
                  </div>

                  <div style={{ display: 'grid', gap: '0.45rem' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-gray-muted)' }}>
                      Galeria (przeciągnij kafelek, aby zmienić kolejność)
                    </span>
                    <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
                      <input
                        value={previewGalleryInput}
                        onChange={(e) => setPreviewGalleryInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddPreviewGalleryUrls();
                          }
                        }}
                        className="newsletter-input"
                        placeholder="Wklej URL (lub wiele URL-i oddzielonych przecinkiem)"
                        style={{ flex: '1 1 320px' }}
                      />
                      <button
                        type="button"
                        onClick={handleAddPreviewGalleryUrls}
                        className="btn-ghost"
                        style={{ padding: '0.52rem 0.9rem' }}
                      >
                        Dodaj
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <button type="button" onClick={dedupePreviewGallery} className="btn-ghost" style={{ padding: '0.42rem 0.7rem', fontSize: '0.74rem' }}>
                        Usuń duplikaty
                      </button>
                      <button type="button" onClick={pinCoverAsFirstGalleryImage} className="btn-ghost" style={{ padding: '0.42rem 0.7rem', fontSize: '0.74rem' }}>
                        Cover jako #1
                      </button>
                      <button type="button" onClick={appendImagesFromBlocks} className="btn-ghost" style={{ padding: '0.42rem 0.7rem', fontSize: '0.74rem' }}>
                        Dodaj z bloków image
                      </button>
                      <button type="button" onClick={() => void copyPreviewAsJson()} className="btn-ghost" style={{ padding: '0.42rem 0.7rem', fontSize: '0.74rem' }}>
                        Kopiuj JSON
                      </button>
                      <button type="button" onClick={() => void pastePreviewFromJson()} className="btn-ghost" style={{ padding: '0.42rem 0.7rem', fontSize: '0.74rem' }}>
                        Wklej JSON
                      </button>
                    </div>
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                      {previewGalleryItems.length === 0 && (
                        <div style={{ fontSize: '0.74rem', color: 'var(--color-gray-muted)' }}>
                          Brak zdjęć w galerii. Dodaj pierwszy URL.
                        </div>
                      )}
                      {previewGalleryItems.map((imageUrl, index) => (
                        <div
                          key={`${index}-${imageUrl}`}
                          draggable
                          onDragStart={() => setDragGalleryIndex(index)}
                          onDragEnd={() => setDragGalleryIndex(null)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (dragGalleryIndex === null) return;
                            setPreviewGalleryItems((prev) => moveItem(prev, dragGalleryIndex, index));
                            setDragGalleryIndex(index);
                          }}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '72px minmax(0, 1fr) auto',
                            gap: '0.55rem',
                            alignItems: 'center',
                            border: dragGalleryIndex === index ? '1px solid var(--color-gold)' : '1px solid var(--glass-border)',
                            borderRadius: '10px',
                            padding: '0.45rem',
                            background: 'rgba(255,255,255,0.02)',
                            cursor: 'grab',
                          }}
                        >
                          <div style={{
                            width: '72px',
                            height: '54px',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: '1px solid var(--glass-border)',
                            background: 'rgba(0,0,0,0.35)',
                          }}>
                            <img
                              src={imageUrl}
                              alt={`Podgląd ${index + 1}`}
                              onError={(event) => hideBrokenImage(event.currentTarget)}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                          </div>
                          <div style={{ display: 'grid', gap: '0.3rem' }}>
                            <div style={{ fontSize: '0.68rem', color: 'var(--color-gold)' }}>
                              #{index + 1} · przeciągnij aby przenieść
                            </div>
                            <input
                              value={imageUrl}
                              onChange={(e) => updatePreviewGalleryItem(index, e.target.value)}
                              className="newsletter-input"
                              style={{ height: '2rem' }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removePreviewGalleryItem(index)}
                            className="btn-ghost"
                            style={{ padding: '0.45rem 0.7rem' }}
                          >
                            Usuń
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                    <label style={{ display: 'grid', gap: '0.3rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-gray-muted)' }}>Skala tekstu: {(previewBodyScale * 100).toFixed(0)}%</span>
                      <input
                        type="range"
                        min={80}
                        max={130}
                        step={2}
                        value={Math.round(previewBodyScale * 100)}
                        onChange={(e) => setPreviewBodyScale(Number(e.target.value) / 100)}
                      />
                    </label>
                    <label style={{ display: 'grid', gap: '0.3rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-gray-muted)' }}>Skala tytułu hero: {(previewHeroTitleScale * 100).toFixed(0)}%</span>
                      <input
                        type="range"
                        min={80}
                        max={130}
                        step={2}
                        value={Math.round(previewHeroTitleScale * 100)}
                        onChange={(e) => setPreviewHeroTitleScale(Number(e.target.value) / 100)}
                      />
                    </label>
                    <label style={{ display: 'grid', gap: '0.3rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-gray-muted)' }}>Wysokość zdjęcia hero: {previewHeroImageHeight}px</span>
                      <input
                        type="range"
                        min={300}
                        max={720}
                        step={10}
                        value={previewHeroImageHeight}
                        onChange={(e) => setPreviewHeroImageHeight(Number(e.target.value))}
                      />
                    </label>
                    <label style={{ display: 'grid', gap: '0.3rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-gray-muted)' }}>Proporcje miniatur galerii</span>
                      <select
                        value={previewGalleryAspectRatio}
                        onChange={(e) => setPreviewGalleryAspectRatio(e.target.value)}
                        className="newsletter-input"
                      >
                        {['1 / 1', '4 / 3', '3 / 2', '16 / 9', '9 / 16'].map((ratio) => (
                          <option key={ratio} value={ratio}>{ratio}</option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: 'grid', gap: '0.3rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-gray-muted)' }}>Liczba kolumn galerii</span>
                      <select
                        value={String(previewGalleryColumns)}
                        onChange={(e) => setPreviewGalleryColumns(Number(e.target.value))}
                        className="newsletter-input"
                      >
                        {[2, 3, 4].map((count) => (
                          <option key={count} value={count}>{count}</option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.74rem', color: 'var(--color-gray-muted)' }}>
                      <input
                        type="checkbox"
                        checked={previewInlineEditMode}
                        onChange={(e) => setPreviewInlineEditMode(e.target.checked)}
                      />
                      Edycja bezpośrednio na podglądzie
                    </label>
                  </div>

                  <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '0.65rem', display: 'grid', gap: '0.65rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <div style={{ fontSize: '0.76rem', color: 'var(--color-gray-muted)' }}>Treść bloków artykułu</div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {[
                          { type: 'heading', label: '+ Nagłówek' },
                          { type: 'paragraph', label: '+ Akapit' },
                          { type: 'tip', label: '+ Wskazówka' },
                          { type: 'image', label: '+ Zdjęcie' },
                          { type: 'cta', label: '+ CTA' },
                        ].map((item) => (
                          <button
                            key={item.type}
                            type="button"
                            onClick={() => addPreviewBlock(item.type)}
                            className="btn-ghost"
                            style={{ padding: '0.35rem 0.6rem', fontSize: '0.72rem' }}
                          >
                            {item.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={autofillImageAlts}
                          className="btn-ghost"
                          style={{ padding: '0.35rem 0.6rem', fontSize: '0.72rem' }}
                        >
                          ALT auto
                        </button>
                      </div>
                    </div>
                    {previewBlocks.map((block, index) => (
                      <div
                        key={`${block.type}-${index}`}
                        style={{
                          border: '1px solid var(--glass-border)',
                          borderRadius: '10px',
                          padding: '0.65rem',
                          display: 'grid',
                          gap: '0.45rem',
                          background: 'rgba(255,255,255,0.02)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                          <div style={{ fontSize: '0.72rem', color: 'var(--color-gold)' }}>
                            Blok {index + 1}: {block.type}
                          </div>
                          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                            <button type="button" onClick={() => movePreviewBlock(index, -1)} disabled={index === 0} className="btn-ghost" style={{ padding: '0.28rem 0.5rem', fontSize: '0.68rem' }}>↑</button>
                            <button type="button" onClick={() => movePreviewBlock(index, 1)} disabled={index === previewBlocks.length - 1} className="btn-ghost" style={{ padding: '0.28rem 0.5rem', fontSize: '0.68rem' }}>↓</button>
                            <button type="button" onClick={() => duplicatePreviewBlock(index)} className="btn-ghost" style={{ padding: '0.28rem 0.5rem', fontSize: '0.68rem' }}>Duplikuj</button>
                            <button type="button" onClick={() => removePreviewBlock(index)} disabled={previewBlocks.length <= 1} className="btn-ghost" style={{ padding: '0.28rem 0.5rem', fontSize: '0.68rem' }}>Usuń</button>
                          </div>
                        </div>
                        {'text' in block && (
                          <textarea
                            value={block.text ?? ''}
                            onChange={(e) => updatePreviewBlock(index, { text: e.target.value })}
                            rows={block.type === 'heading' ? 2 : 4}
                            className="newsletter-input"
                            style={{ resize: 'vertical', paddingTop: '0.6rem', paddingBottom: '0.6rem' }}
                          />
                        )}
                        {(block.type === 'cta' || block.type === 'image') && (
                          <div style={{ display: 'grid', gap: '0.4rem' }}>
                            <input
                              value={block.url ?? block.src ?? ''}
                              onChange={(e) => {
                                if (block.type === 'image') {
                                  updatePreviewBlock(index, { src: e.target.value, url: e.target.value });
                                  return;
                                }
                                updatePreviewBlock(index, { url: e.target.value });
                              }}
                              className="newsletter-input"
                              placeholder="URL (opcjonalnie)"
                            />
                            {block.type === 'image' && (
                              <input
                                value={block.alt ?? ''}
                                onChange={(e) => updatePreviewBlock(index, { alt: e.target.value })}
                                className="newsletter-input"
                                placeholder="ALT zdjęcia"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {previewError && <div style={{ color: '#ef4444', fontSize: '0.78rem' }}>{previewError}</div>}
                  {previewNotice && <div style={{ color: '#10b981', fontSize: '0.78rem' }}>{previewNotice}</div>}

                  <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={handleSavePreviewEdits}
                      className="btn-primary"
                      disabled={previewSaving}
                      style={{ padding: '0.55rem 0.95rem' }}
                    >
                      {previewSaving ? 'Zapisywanie...' : 'Zapisz zmiany draftu'}
                    </button>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-gray-muted)' }}>
                      Skróty: Ctrl/Cmd+S zapis, Ctrl/Cmd+Z cofnij, Ctrl/Cmd+Shift+Z ponów
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (!article) return;
                        const resetSnapshot: PreviewEditorSnapshot = {
                          title: article.title,
                          coverImage: article.coverImage ?? '',
                          galleryItems: [...(article.galleryImages ?? [])],
                          galleryInput: '',
                          blocks: (article.content ?? []).map((block) => ({ ...block })),
                          bodyScale: 1,
                          heroTitleScale: 1,
                          heroImageHeight: 460,
                          galleryAspectRatio: '4 / 3',
                          galleryColumns: 3,
                          inlineEditMode: true,
                        };
                        applyPreviewSnapshot(resetSnapshot);
                        resetPreviewHistory(resetSnapshot);
                        setDragGalleryIndex(null);
                        setPreviewError('');
                        setPreviewNotice('');
                        setPreviewDirty(false);
                        savedSignatureRef.current = createPreviewSignature({
                          title: resetSnapshot.title,
                          coverImage: resetSnapshot.coverImage,
                          galleryItems: resetSnapshot.galleryItems,
                          blocks: resetSnapshot.blocks,
                        });
                      }}
                      className="btn-ghost"
                      style={{ padding: '0.55rem 0.95rem' }}
                    >
                      Reset podglądu
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

                {/* Hero */}
        <div style={{
          background: 'var(--surface-page)',
          borderBottom: '1px solid var(--glass-border)',
        }}>
          <div className="container-site" style={{ paddingTop: '1rem', paddingBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
              <Link href="/" style={{ fontSize: '0.78rem', color: 'var(--color-gray-muted)' }}>
                {lang === 'pl' ? 'Strona Główna' : 'Home'}
              </Link>
              <span style={{ color: 'var(--color-gold)', fontSize: '0.78rem' }}>›</span>
              <Link href="/blog" style={{ fontSize: '0.78rem', color: 'var(--color-gray-muted)' }}>Blog</Link>
              <span style={{ color: 'var(--color-gold)', fontSize: '0.78rem' }}>›</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-cream)' }}>
                {lang === 'pl' ? article.category : article.categoryEn}
              </span>
            </div>

            <div className="hero-topbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <span className="badge">
                  {lang === 'pl' ? article.category : article.categoryEn}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', color: 'var(--color-gray-muted)' }}>
                  <Calendar size={13} />
                  {lang === 'pl' ? article.date : article.dateEn}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', color: 'var(--color-gray-muted)' }}>
                  <Clock size={13} />
                  {article.readTime} min {lang === 'pl' ? 'czytania' : 'read'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-gray-muted)' }}>
                  {lang === 'pl' ? 'Udostępnij:' : 'Share:'}
                </span>
                <button
                  onClick={() => navigator.share?.({ title: article.title, url: window.location.href })}
                  style={{
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '8px',
                    padding: '0.38rem 0.82rem',
                    color: 'var(--color-gray-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.78rem',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  <Share2 size={13} /> Share
                </button>
              </div>
            </div>

            <div className={`hero-stage ${heroRatioClass}`}>
              <div className="hero-caption">
                {isPreview && previewInlineEditMode ? (
                  <textarea
                    value={activeTitle}
                    onChange={(event) => setPreviewTitle(event.target.value)}
                    rows={3}
                    style={{
                      width: '100%',
                      fontSize: heroTitleSize,
                      lineHeight: 1.05,
                      margin: 0,
                      maxWidth: '18ch',
                      color: 'var(--color-cream)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '12px',
                      background: 'rgba(255,255,255,0.04)',
                      padding: '0.55rem 0.7rem',
                      outline: 'none',
                      resize: 'vertical',
                      fontFamily: 'var(--font-display)',
                    }}
                  />
                ) : (
                  <h1 style={{
                    fontSize: heroTitleSize,
                    lineHeight: 1.05,
                    margin: 0,
                    maxWidth: '18ch',
                  }}>
                    {activeTitle}
                  </h1>
                )}
              </div>

              <div className="hero-main" style={{
                borderRadius: '18px',
                overflow: 'hidden',
                border: '1px solid rgba(212,168,83,0.24)',
                background: 'var(--surface-overlay-soft)',
                minHeight: heroImageHeight,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}>
                {isPreview && previewInlineEditMode && (
                  <div style={{ position: 'absolute', top: '0.6rem', right: '0.6rem', zIndex: 2, display: 'flex', gap: '0.4rem' }}>
                    <button type="button" onClick={() => setPreviewHeroImageHeight((v) => Math.max(260, v - 20))} className="btn-ghost" style={{ padding: '0.3rem 0.55rem', fontSize: '0.72rem' }}>-</button>
                    <button type="button" onClick={() => setPreviewHeroImageHeight((v) => Math.min(900, v + 20))} className="btn-ghost" style={{ padding: '0.3rem 0.55rem', fontSize: '0.72rem' }}>+</button>
                  </div>
                )}
                {heroMainImage ? (
                  <a href={heroMainImage} target="_blank" rel="noopener noreferrer" style={{ display: 'block', width: '100%', height: '100%' }}>
                    <img
                      src={heroMainImage}
                      alt={activeTitle}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'center center',
                        display: 'block',
                      }}
                      onError={(event) => hideBrokenImage(event.currentTarget)}
                    />
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Main content layout */}
        <div className="container-site" style={{ padding: '3rem clamp(1.5rem, 5vw, 3rem)' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: articleLayoutColumns,
              gap: articleLayoutGap,
            }}
            className="article-layout"
          >

            {/* Article Body */}
            <article>
              {isPreview && previewInlineEditMode && (
                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
                  <button type="button" onClick={() => setPreviewBodyScale((v) => Math.max(0.8, Number((v - 0.02).toFixed(2))))} className="btn-ghost" style={{ padding: '0.34rem 0.58rem', fontSize: '0.72rem' }}>A-</button>
                  <button type="button" onClick={() => setPreviewBodyScale((v) => Math.min(1.4, Number((v + 0.02).toFixed(2))))} className="btn-ghost" style={{ padding: '0.34rem 0.58rem', fontSize: '0.72rem' }}>A+</button>
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-gray-muted)', alignSelf: 'center' }}>
                    Edycja inline aktywna
                  </span>
                </div>
              )}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <ContentRenderer
                  blocks={activeContent}
                  lang={lang}
                  productLinks={article.productLinks}
                  textScale={isPreview ? previewBodyScale : 1}
                  inlineEditMode={isPreview && previewInlineEditMode}
                  onBlockChange={isPreview ? updatePreviewBlock : undefined}
                />
              </motion.div>

              {galleryImages.length > 1 && (
                <section style={{ marginTop: '2.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    <h3 style={{ marginBottom: 0, fontSize: '1.25rem' }}>
                      {gallerySectionTitle}
                    </h3>
                    {isPreview && previewInlineEditMode && (
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button type="button" onClick={() => setPreviewGalleryColumns((v) => Math.max(2, v - 1))} className="btn-ghost" style={{ padding: '0.3rem 0.55rem', fontSize: '0.72rem' }}>Mniej kolumn</button>
                        <button type="button" onClick={() => setPreviewGalleryColumns((v) => Math.min(4, v + 1))} className="btn-ghost" style={{ padding: '0.3rem 0.55rem', fontSize: '0.72rem' }}>Więcej kolumn</button>
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${galleryColumns}, minmax(0, 1fr))`,
                      gap: '0.9rem',
                    }}
                    className="article-gallery"
                  >
                    {galleryImages.map((img, index) => (
                      <a
                        key={`${img}-${index}`}
                        href={img}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="article-gallery-item"
                        style={{
                          display: 'block',
                          aspectRatio: galleryAspectRatio,
                          borderRadius: '12px',
                          overflow: 'hidden',
                          background: 'var(--image-overlay-soft)',
                        }}
                      >
                        <img
                          src={img}
                          alt={`${lang === 'pl' ? 'Zdjęcie produktu' : 'Product photo'} ${index + 1}`}
                          onError={(event) => hideBrokenImage(event.currentTarget)}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            objectPosition: 'center center',
                            borderRadius: '12px',
                            border: '1px solid var(--glass-border)',
                            display: 'block',
                          }}
                          loading="lazy"
                        />
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {/* Tags */}
              <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <Tag size={14} style={{ color: 'var(--color-gold)' }} />
                  {(lang === 'pl' ? article.tags : article.tagsEn).map((tag) => (
                    <span key={tag} style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '100px',
                      border: '1px solid var(--glass-border)',
                      fontSize: '0.78rem',
                      color: 'var(--color-gray-muted)',
                      background: 'var(--glass-bg)',
                    }}>
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Author Card */}
              <div style={{
                marginTop: '2.5rem',
                background: 'var(--color-black-card)',
                border: '1px solid var(--glass-border)',
                borderRadius: '16px',
                padding: '1.5rem',
                display: 'flex', alignItems: 'center', gap: '1.25rem',
              }}>
                <div style={{
                  width: '56px', height: '56px', borderRadius: '50%',
                  background: 'var(--color-gold-dim)',
                  border: '2px solid var(--color-gold)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <BookOpen size={22} color="var(--color-gold)" />
                </div>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-cream)', marginBottom: '0.2rem' }}>
                    {article.author}
                  </div>
                  <div style={{ fontSize: '0.825rem', color: 'var(--color-gold)' }}>
                    {article.authorRole} · Gedeon
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem', flexWrap: 'wrap' }}>
                <Link href="/blog" className="btn-ghost">
                  <ArrowLeft size={15} />
                  {lang === 'pl' ? 'Wszystkie artykuły' : 'All articles'}
                </Link>
              </div>
            </article>

            {/* Sidebar */}
            <aside style={{ position: 'relative' }}>
              <div style={{ position: 'sticky', top: '100px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                {/* B2B CTA */}
                <div style={{
                  background: 'linear-gradient(135deg, var(--color-black-card) 0%, rgba(212,168,83,0.12) 100%)',
                  border: '1px solid rgba(212,168,83,0.3)',
                  borderRadius: '16px', padding: '1.5rem', textAlign: 'center',
                }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-gold)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                    Gedeon
                  </div>
                  <h4 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>
                    {lang === 'pl' ? 'Zamów produkty hurtowo' : 'Order wholesale products'}
                  </h4>
                  <p style={{ fontSize: '0.82rem', marginBottom: '1.25rem' }}>
                    {lang === 'pl' ? 'Albumy, ramki, media — dla studiów, sklepów foto i minilabów.' : 'Albums, frames, media — for studios, photo shops and minilabs.'}
                  </p>
                  <a href="https://b2b.gedeonpolska.com" target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                    Platforma B2B
                    <ExternalLink size={14} />
                  </a>
                  <a href="https://gedeonpolska.myshopify.com" target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ width: '100%', justifyContent: 'center', marginTop: '0.625rem' }}>
                    Sklep B2C
                  </a>
                </div>

                {/* Products from article */}
                {article.productLinks.length > 0 && (
                  <div style={{
                    background: 'var(--color-black-card)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '16px', padding: '1.5rem',
                  }}>
                    <h5 style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'var(--color-gold)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '1rem' }}>
                      {lang === 'pl' ? 'Produkty z artykułu' : 'Products from article'}
                    </h5>
                    {article.productLinks.map((p, i) => (
                      <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.75rem 0',
                        borderBottom: i < article.productLinks.length - 1 ? '1px solid var(--glass-border)' : 'none',
                        textDecoration: 'none',
                      }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '8px',
                          background: 'var(--color-gold-dim)', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <BookOpen size={14} color="var(--color-gold)" />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--color-cream)', fontWeight: 500 }}>{p.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-muted)' }}>{p.description}</div>
                        </div>
                      </a>
                    ))}
                  </div>
                )}

                {/* Newsletter mini */}
                <div style={{
                  background: 'var(--color-black-card)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '16px', padding: '1.5rem',
                }}>
                  <h5 style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'var(--color-gold)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                    Newsletter
                  </h5>
                  <p style={{ fontSize: '0.82rem', marginBottom: '1rem' }}>
                    {lang === 'pl' ? 'Nowości produktowe co 2 tygodnie.' : 'Product news every 2 weeks.'}
                  </p>
                  <input
                    type="email"
                    placeholder="email@studio.pl"
                    className="newsletter-input"
                    style={{ marginBottom: '0.625rem' }}
                  />
                  <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                    {lang === 'pl' ? 'Subskrybuj' : 'Subscribe'}
                  </button>
                </div>

                {sidebarImage && (
                  <a
                    href={sidebarImage}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'block',
                      borderRadius: '14px',
                      overflow: 'hidden',
                      border: '1px solid var(--glass-border)',
                      background: 'var(--image-overlay-soft)',
                    }}
                  >
                    <img
                      src={sidebarImage}
                      alt={lang === 'pl' ? 'Zdjęcie artykułu' : 'Article image'}
                      onError={(event) => hideBrokenImage(event.currentTarget)}
                      style={{
                        width: '100%',
                        aspectRatio: '4 / 3',
                        objectFit: 'cover',
                        objectPosition: 'center center',
                        display: 'block',
                      }}
                      loading="lazy"
                    />
                  </a>
                )}
              </div>
            </aside>
          </div>
        </div>

        {/* Related Articles */}
        <section style={{ background: 'var(--color-black-soft)', padding: '4rem 0' }}>
          <div className="container-site">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
              <div style={{ width: '4px', height: '28px', background: 'var(--color-gold)', borderRadius: '2px' }} />
              <h3>{lang === 'pl' ? 'Powiązane Artykuły' : 'Related Articles'}</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {relatedArticles.map((a, i) => (
                <ArticleCard key={a.id} article={a} lang={lang} index={i} />
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer lang={lang} />

      <style jsx>{`
        .article-layout { grid-template-columns: 1fr 320px; }
        .hero-stage {
          display: grid;
          gap: 1.2rem;
          align-items: stretch;
          margin-top: 0.9rem;
        }
        .hero-stage-5545 {
          grid-template-columns: minmax(0, 1.12fr) minmax(360px, 0.88fr);
        }
        .hero-stage-6040 {
          grid-template-columns: minmax(0, 1.24fr) minmax(340px, 0.76fr);
        }
        .hero-stage-5050 {
          grid-template-columns: minmax(0, 1fr) minmax(340px, 1fr);
        }
        .hero-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          border-top: 1px solid var(--glass-border);
          border-bottom: 1px solid var(--glass-border);
          padding: 0.85rem 0;
        }
        .hero-caption {
          border: 1px solid rgba(212,168,83,0.2);
          border-radius: 16px;
          padding: 1.4rem;
          background: var(--image-overlay-soft);
          display: flex;
          align-items: center;
        }
        @media (max-width: 900px) {
          .article-layout { grid-template-columns: 1fr !important; }
          .article-gallery { grid-template-columns: 1fr !important; }
          .hero-stage {
            grid-template-columns: 1fr !important;
            gap: 0.9rem;
          }
          .hero-caption {
            padding: 1rem;
          }
        }
        @media (max-width: 640px) {
          .article-gallery-item { aspect-ratio: 4 / 3 !important; }
          .hero-topbar {
            flex-direction: column;
            align-items: flex-start;
          }
          .hero-main {
            min-height: 260px !important;
          }
          .hero-caption h1 {
            font-size: clamp(2rem, 9vw, 3rem) !important;
          }
        }
      `}</style>
    </>
  );
}



